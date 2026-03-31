"""Job management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
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


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Job:
    """Create a new simulation job."""
    service = JobService(db)
    job = await service.create_job(user=current_user, data=body)
    return job


@router.get("", response_model=JobListResponse)
async def list_jobs(
    skip: int = 0,
    limit: int = 50,
    status_filter: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List jobs for the current user, optionally filtered by status and name search."""
    query = select(Job).where(Job.user_id == current_user.id)
    count_query = select(func.count()).select_from(Job).where(Job.user_id == current_user.id)

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

    return {"items": items, "total": total}


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Job:
    """Get full details for a single job."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


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
