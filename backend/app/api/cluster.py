"""Cluster status endpoint."""

import logging

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cluster", tags=["cluster"])


@router.get("/status")
async def cluster_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return current HPC cluster health and queue summary."""
    if settings.CLUSTER_MOCK_MODE:
        from app.cluster.mock import MockSSHManager, MockSlurmManager

        ssh = MockSSHManager()
        slurm = MockSlurmManager(ssh)
        info = slurm.get_cluster_info()
        queue = slurm.get_queue()

        return {
            "connected": True,
            "nodes": {
                "total": info.get("total", 8),
                "idle": info.get("idle", 4),
                "allocated": info.get("allocated", 2),
                "down": info.get("down", 0),
            },
            "queue": {
                "pending": sum(1 for j in queue if j.get("state") == "PENDING"),
                "running": sum(1 for j in queue if j.get("state") == "RUNNING"),
            },
            "message": "Mock cluster (development mode)",
        }

    try:
        from app.cluster.ssh_manager import SSHManager
        from app.cluster.slurm import SlurmManager

        ssh = SSHManager()
        ssh.connect()
        slurm = SlurmManager(ssh)

        info = slurm.get_cluster_info()
        queue = slurm.get_queue()
        ssh.close()

        return {
            "connected": True,
            "nodes": {
                "total": info.get("total", 0),
                "idle": info.get("idle", 0),
                "allocated": info.get("allocated", 0),
                "down": info.get("down", 0),
            },
            "queue": {
                "pending": sum(1 for j in queue if j.get("state") == "PENDING"),
                "running": sum(1 for j in queue if j.get("state") == "RUNNING"),
            },
            "message": None,
        }
    except Exception as exc:
        logger.warning("Failed to query cluster: %s", exc)
        return {
            "connected": False,
            "nodes": {"total": 0, "idle": 0, "allocated": 0, "down": 0},
            "queue": {"pending": 0, "running": 0},
            "message": f"Connection failed: {exc}",
        }
