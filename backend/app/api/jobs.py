"""Job management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.group import Group, GroupMembership
from app.models.job import Job
from app.models.user import User
from app.schemas.job import (
    ForceReport,
    JobCreate,
    JobListResponse,
    JobResponse,
    JobStatusResponse,
    ResidualData,
    SweepCreate,
    SweepResponse,
)
from app.services.job_service import JobService

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _job_to_response(job: Job, group_name: str | None = None, mesh_summary: dict | None = None) -> dict:
    """Convert a Job ORM instance to a dict suitable for JobResponse, including computed fields."""
    d = {c.name: getattr(job, c.name) for c in job.__table__.columns}
    d["group_name"] = group_name
    d["mesh"] = mesh_summary
    return d


async def _fetch_mesh_summary(db, mesh_id):
    if mesh_id is None:
        return None
    from app.models.mesh import Mesh
    r = await db.execute(select(Mesh).where(Mesh.id == mesh_id))
    m = r.scalar_one_or_none()
    if m is None:
        return None
    return {
        "id": str(m.id),
        "name": m.name,
        "status": m.status.value if hasattr(m.status, "value") else str(m.status),
        "cell_count": m.cell_count,
        "meshing_minutes": m.meshing_minutes,
    }


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a new simulation job."""
    service = JobService(db)
    job = await service.create_job(user=current_user, data=body)
    group_name = None
    if job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
        group_name = gr.scalar_one_or_none()
    mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
    return _job_to_response(job, group_name, mesh_summary)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    search: str | None = None,
    group_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List jobs. By default returns only the user's jobs.
    Pass group_id to see all jobs shared with that group (requires membership).
    """
    if group_id:
        mem = await db.execute(
            select(GroupMembership).where(
                GroupMembership.user_id == current_user.id,
                GroupMembership.group_id == group_id,
            )
        )
        if mem.scalar_one_or_none() is None:
            raise HTTPException(status_code=403, detail="Not a member of this group")
        base_filter = Job.group_id == group_id
    else:
        base_filter = Job.user_id == current_user.id

    query = select(Job).where(base_filter)
    count_query = select(func.count()).select_from(Job).where(base_filter)

    if status_filter:
        query = query.where(Job.status == status_filter)
        count_query = count_query.where(Job.status == status_filter)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(Job.name.ilike(search_pattern))
        count_query = count_query.where(Job.name.ilike(search_pattern))

    query = query.order_by(Job.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = list(result.scalars().all())
    total = (await db.execute(count_query)).scalar() or 0

    group_name_cache: dict[uuid.UUID, str | None] = {}
    owner_name_cache: dict[uuid.UUID, str | None] = {}
    response_items = []
    for job in items:
        gn = None
        if job.group_id:
            if job.group_id not in group_name_cache:
                gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
                group_name_cache[job.group_id] = gr.scalar_one_or_none()
            gn = group_name_cache[job.group_id]

        if job.user_id not in owner_name_cache:
            ur = await db.execute(select(User.name).where(User.id == job.user_id))
            owner_name_cache[job.user_id] = ur.scalar_one_or_none()

        mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
        d = _job_to_response(job, gn, mesh_summary)
        d["owner_name"] = owner_name_cache[job.user_id]
        response_items.append(d)

    return {"items": response_items, "total": total}


@router.post("/sweep", response_model=SweepResponse, status_code=status.HTTP_201_CREATED)
async def create_sweep(
    body: SweepCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a parametric sweep: multiple jobs varying a single parameter.

    Creates one job per value in sweep_param.values, each with the base config
    but the specified parameter overridden.
    """
    if len(body.sweep_param.values) < 2:
        raise HTTPException(status_code=400, detail="Sweep needs at least 2 values")
    if len(body.sweep_param.values) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 sweep points")
    if len(body.sweep_param.path) < 2:
        raise HTTPException(status_code=400, detail="Parameter path must have at least 2 segments")

    service = JobService(db)
    created_jobs = []

    for val in body.sweep_param.values:
        mesh_dict = body.mesh_config.model_dump()
        solver_dict = body.solver_config.model_dump()
        slurm_dict = body.slurm_config.model_dump()

        section = body.sweep_param.path[0]
        sub_path = body.sweep_param.path[1:]

        if section == "mesh":
            target = mesh_dict
        elif section == "solver":
            target = solver_dict
        elif section == "slurm":
            target = slurm_dict
        else:
            raise HTTPException(status_code=400, detail=f"Unknown config section: {section}")

        for key in sub_path[:-1]:
            if key not in target:
                raise HTTPException(status_code=400, detail=f"Invalid path key: {key}")
            target = target[key]
        leaf_key = sub_path[-1]
        if leaf_key not in target:
            raise HTTPException(status_code=400, detail=f"Invalid leaf key: {leaf_key}")
        target[leaf_key] = val

        param_label = body.sweep_param.path[-1].replace("_", " ").title()
        job_name = f"{body.base_name} — {param_label}={val}"

        from app.schemas.job import MeshConfig, SolverConfig, SlurmConfig
        job_create = JobCreate(
            geometry_id=body.geometry_id,
            name=job_name,
            group_id=body.group_id,
            cfd_mode=body.cfd_mode,
            mesh_config=MeshConfig(**mesh_dict),
            solver_config=SolverConfig(**solver_dict),
            slurm_config=SlurmConfig(**slurm_dict),
        )
        job = await service.create_job(user=current_user, data=job_create)

        if body.auto_submit:
            job = await service.submit_job(user=current_user, job_id=job.id)

        group_name = None
        if job.group_id:
            gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
            group_name = gr.scalar_one_or_none()
        mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
        created_jobs.append(_job_to_response(job, group_name, mesh_summary))

    return {
        "jobs": created_jobs,
        "sweep_param": body.sweep_param.model_dump(),
    }


@router.get("/compare/data")
async def compare_jobs(
    ids: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return job details with force/residual data for multiple jobs (for comparison).

    Query param `ids` is a comma-separated list of job UUIDs (max 6).
    """
    raw_ids = [s.strip() for s in ids.split(",") if s.strip()]
    if len(raw_ids) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 job IDs")
    if len(raw_ids) > 6:
        raise HTTPException(status_code=400, detail="Maximum 6 jobs for comparison")

    job_uuids = []
    for rid in raw_ids:
        try:
            job_uuids.append(uuid.UUID(rid))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid UUID: {rid}")

    service = JobService(db)
    results = []
    for jid in job_uuids:
        result = await db.execute(select(Job).where(Job.id == jid))
        job = result.scalar_one_or_none()
        if job is None:
            continue

        allowed = job.user_id == current_user.id
        if not allowed and job.group_id:
            mem = await db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == current_user.id,
                    GroupMembership.group_id == job.group_id,
                )
            )
            allowed = mem.scalar_one_or_none() is not None
        if not allowed:
            continue

        forces = await service.get_force_data(user=current_user, job_id=jid)
        residuals_data = await service.get_residual_data(user=current_user, job_id=jid)

        results.append({
            "job": _job_to_response(job),
            "forces": forces,
            "residuals": residuals_data,
        })

    return results


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get full details for a single job. Accessible by owner or group members."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    allowed = job.user_id == current_user.id
    if not allowed and job.group_id:
        mem = await db.execute(
            select(GroupMembership).where(
                GroupMembership.user_id == current_user.id,
                GroupMembership.group_id == job.group_id,
            )
        )
        allowed = mem.scalar_one_or_none() is not None

    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    group_name = None
    if job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
        group_name = gr.scalar_one_or_none()

    ur = await db.execute(select(User.name).where(User.id == job.user_id))
    owner_name = ur.scalar_one_or_none()

    mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
    d = _job_to_response(job, group_name, mesh_summary)
    d["owner_name"] = owner_name
    return d


@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Job:
    """Quick status check for a job."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.post("/{job_id}/submit", response_model=JobResponse)
async def submit_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Submit a draft job to the HPC cluster."""
    service = JobService(db)
    job = await service.submit_job(user=current_user, job_id=job_id)
    # MUST return a dict, not the bare Job ORM object: the JobResponse model
    # serialises `mesh` from attributes, which would lazy-load the SQLAlchemy
    # relationship and raise MissingGreenlet under async sessions.
    group_name = None
    if job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
        group_name = gr.scalar_one_or_none()
    mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
    return _job_to_response(job, group_name, mesh_summary)


@router.post("/{job_id}/sync", response_model=JobResponse)
async def sync_job_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check the job's real status on the cluster and update the DB.

    Useful when a job was cancelled via terminal (scancel) or the OOD
    session expired — the periodic poller may not have picked it up yet.
    """
    service = JobService(db)
    job = await service.sync_job_status(user=current_user, job_id=job_id)
    group_name = None
    if job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
        group_name = gr.scalar_one_or_none()
    mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
    return _job_to_response(job, group_name, mesh_summary)


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Cancel a queued or running job."""
    service = JobService(db)
    job = await service.cancel_job(user=current_user, job_id=job_id)
    group_name = None
    if job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == job.group_id))
        group_name = gr.scalar_one_or_none()
    mesh_summary = await _fetch_mesh_summary(db, job.mesh_id)
    return _job_to_response(job, group_name, mesh_summary)


@router.post("/{job_id}/resubmit", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def resubmit_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Clone a completed/failed job and resubmit it."""
    service = JobService(db)
    new_job = await service.resubmit_job(user=current_user, job_id=job_id)
    group_name = None
    if new_job.group_id:
        gr = await db.execute(select(Group.name).where(Group.id == new_job.group_id))
        group_name = gr.scalar_one_or_none()
    mesh_summary = await _fetch_mesh_summary(db, new_job.mesh_id)
    return _job_to_response(new_job, group_name, mesh_summary)


@router.get("/{job_id}/forces", response_model=list[ForceReport])
async def get_forces(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Retrieve aerodynamic force coefficients for a completed job."""
    service = JobService(db)
    forces = await service.get_force_data(user=current_user, job_id=job_id)
    return forces


@router.get("/{job_id}/residuals", response_model=list[ResidualData])
async def get_residuals(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Retrieve solver residual history for a completed job."""
    service = JobService(db)
    residuals = await service.get_residual_data(user=current_user, job_id=job_id)
    return residuals
