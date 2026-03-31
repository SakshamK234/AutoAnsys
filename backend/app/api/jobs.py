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
)
from app.services.job_service import JobService

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _job_to_response(job: Job, group_name: str | None = None) -> dict:
    """Convert a Job ORM instance to a dict suitable for JobResponse, including computed fields."""
    d = {c.name: getattr(job, c.name) for c in job.__table__.columns}
    d["group_name"] = group_name
    return d


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
    return _job_to_response(job, group_name)


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

        d = _job_to_response(job, gn)
        d["owner_name"] = owner_name_cache[job.user_id]
        response_items.append(d)

    return {"items": response_items, "total": total}


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

    d = _job_to_response(job, group_name)
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
) -> Job:
    """Submit a draft job to the HPC cluster."""
    service = JobService(db)
    job = await service.submit_job(user=current_user, job_id=job_id)
    return job


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Job:
    """Cancel a queued or running job."""
    service = JobService(db)
    job = await service.cancel_job(user=current_user, job_id=job_id)
    return job


@router.post("/{job_id}/resubmit", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def resubmit_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Job:
    """Clone a completed/failed job and resubmit it."""
    service = JobService(db)
    new_job = await service.resubmit_job(user=current_user, job_id=job_id)
    return new_job


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
