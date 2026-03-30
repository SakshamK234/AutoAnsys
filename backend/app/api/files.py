"""File browser endpoints for cluster workspace inspection."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{job_id}")
async def list_job_files(
    job_id: str,
    path: str = "/",
    current_user: User = Depends(get_current_user),
) -> dict:
    """List files in a job's cluster workspace directory.

    TODO: Use SSHManager / SFTP to read the remote directory listing and return
    it as a structured list of {name, type, size, modified} entries.
    """
    return {
        "job_id": job_id,
        "path": path,
        "files": [],
        "message": "Not yet implemented",
    }


@router.get("/{job_id}/download")
async def download_job_file(
    job_id: str,
    path: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Download a specific file from the job workspace.

    TODO: Stream the file from cluster via SFTP -> S3 presigned URL or direct
    StreamingResponse.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="File download not yet implemented",
    )
