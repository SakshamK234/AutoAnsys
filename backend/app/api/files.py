"""Result file listing and download endpoints."""

import uuid

import boto3
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models.job import Job
from app.models.result_file import ResultFile
from app.models.user import User
from app.schemas.job import ResultFileResponse

router = APIRouter(prefix="/api/files", tags=["files"])


async def _verify_job_ownership(
    job_id: uuid.UUID, user: User, db: AsyncSession
) -> Job:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/{job_id}", response_model=list[ResultFileResponse])
async def list_job_files(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ResultFile]:
    """List result files for a completed job."""
    await _verify_job_ownership(job_id, current_user, db)

    result = await db.execute(
        select(ResultFile)
        .where(ResultFile.job_id == job_id)
        .order_by(ResultFile.filename)
    )
    return list(result.scalars().all())


@router.get("/{job_id}/download/{file_id}")
async def download_result_file(
    job_id: uuid.UUID,
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Generate a presigned download URL for a result file."""
    await _verify_job_ownership(job_id, current_user, db)

    result = await db.execute(
        select(ResultFile).where(
            ResultFile.id == file_id,
            ResultFile.job_id == job_id,
        )
    )
    rf = result.scalar_one_or_none()
    if rf is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Result file not found"
        )

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": rf.s3_key},
        ExpiresIn=3600,
    )
    return {"url": url, "filename": rf.filename}
