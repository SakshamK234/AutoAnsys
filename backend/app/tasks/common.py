"""Helpers shared by the Celery task modules."""

from __future__ import annotations

from app.config import settings


def pinned_slurm_config(slurm: dict) -> dict:
    """Return a copy of a job's SLURM config with the account pinned server-side.

    Users can size resources but never choose which allocation gets billed
    (GUI_PLAN G2.4): whatever the stored config says, the account rendered into
    ``#SBATCH --account`` is the deployment's ``CLUSTER_ACCOUNT``. The
    placeholder default means "not configured" and is left for mock mode.
    """
    pinned = dict(slurm or {})
    if settings.CLUSTER_ACCOUNT and settings.CLUSTER_ACCOUNT != "your_slurm_account":
        pinned["account"] = settings.CLUSTER_ACCOUNT
    return pinned
