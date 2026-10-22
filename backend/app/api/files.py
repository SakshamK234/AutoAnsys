"""Result file listing and download endpoints."""

import uuid

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


async def _verify_job_access(
    job_id: uuid.UUID, user: User, db: AsyncSession
) -> Job:
    """Owner or group member may read a job's files.

    Mirrors the group semantics of /jobs/{id}, /forces and /residuals — a
    teammate who can open a shared run must also see its contours and logs.
    """
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.user_id == user.id:
        return job
    if job.group_id is not None:
        from app.models.group import GroupMembership

        member = await db.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == job.group_id,
                GroupMembership.user_id == user.id,
            )
        )
        if member.scalar_one_or_none() is not None:
            return job
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")


@router.get("/{job_id}", response_model=list[ResultFileResponse])
async def list_job_files(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ResultFile]:
    """List result files for a completed job."""
    await _verify_job_access(job_id, current_user, db)

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
    await _verify_job_access(job_id, current_user, db)

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

    from app.utils.s3 import s3_presign_client

    url = s3_presign_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": rf.s3_key},
        ExpiresIn=3600,
    )
    return {"url": url, "filename": rf.filename}
