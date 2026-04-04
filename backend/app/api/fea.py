"""FEA job management endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.fea import (
    FEAJobListResponse,
    FEAJobResponse,
    FEAStatusResponse,
    FEASubmitPayload,
)
from app.services.fea_service import FEAService

router = APIRouter(prefix="/api/fea", tags=["fea"])


@router.post("/submit", response_model=FEAJobResponse, status_code=status.HTTP_201_CREATED)
async def submit_fea_job(
    body: FEASubmitPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validate inputs, generate solver files, submit FEA job to the cluster."""
    service = FEAService(db)
    job = await service.submit_job(user=current_user, payload=body)
    return job


@router.get("/jobs", response_model=FEAJobListResponse)
async def list_fea_jobs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List FEA jobs for the current user."""
    service = FEAService(db)
    items, total = await service.list_jobs(user=current_user, skip=skip, limit=limit)
    return {"items": items, "total": total}


@router.get("/jobs/{job_id}", response_model=FEAJobResponse)
async def get_fea_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full details for a single FEA job."""
    service = FEAService(db)
    return await service.get_job(user=current_user, job_id=job_id)


@router.get("/status/{job_id}", response_model=FEAStatusResponse)
async def get_fea_status(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll SLURM status and update the FEA job record."""
    service = FEAService(db)
    return await service.get_status(user=current_user, job_id=job_id)


@router.get("/results/{job_id}", response_model=FEAJobResponse)
async def get_fea_results(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return parsed FEA results for a completed job."""
    service = FEAService(db)
    return await service.get_results(user=current_user, job_id=job_id)


@router.get("/log/{job_id}", response_class=PlainTextResponse)
async def get_fea_log(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return raw solver log text for an FEA job."""
    service = FEAService(db)
    log_text = await service.get_log(user=current_user, job_id=job_id)
    return log_text


@router.delete("/cancel/{job_id}", response_model=FEAJobResponse)
async def cancel_fea_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending/queued/running FEA job."""
    service = FEAService(db)
    return await service.cancel_job(user=current_user, job_id=job_id)


@router.get("/download/{job_id}/{filename}")
async def download_fea_file(
    job_id: uuid.UUID,
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a result file from a completed FEA job.

    TODO: Stream file from cluster workspace or S3.
    """
    service = FEAService(db)
    job = await service.get_job(user=current_user, job_id=job_id)
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Downloads are only available for completed jobs",
        )
    # TODO: implement actual file streaming from cluster/S3
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="File download not yet implemented — retrieve from cluster workspace",
    )
