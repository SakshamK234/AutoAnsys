"""Cluster status endpoint."""

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/cluster", tags=["cluster"])


@router.get("/status")
async def cluster_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return current HPC cluster health and queue summary.

    TODO: SSH into cluster, run squeue/sinfo, and aggregate:
    - node availability (total, idle, allocated, down)
    - queue depth (pending, running)
    - current user's running / pending jobs
    """
    return {
        "connected": False,
        "nodes": {"total": 0, "idle": 0, "allocated": 0, "down": 0},
        "queue": {"pending": 0, "running": 0},
        "message": "Not yet implemented — cluster connection not established",
    }
