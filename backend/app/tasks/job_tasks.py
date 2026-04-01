"""Celery tasks for job lifecycle management."""

from __future__ import annotations

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.job_tasks.submit_job_to_cluster")
def submit_job_to_cluster(job_id: str) -> dict:
    """Submit a job to the HPC cluster.

    Steps:
    1. Load job config from database.
    2. Generate journal files (mesh + solver) via JournalGenerator.
    3. Generate SLURM batch script.
    4. Connect to cluster via SSH.
    5. Create workspace directory.
    6. Upload geometry, journals, and SLURM script via SFTP.
    7. Submit job via sbatch.
    8. Update job record with slurm_job_id and status.
    """
    logger.info("Submitting job %s to cluster", job_id)

    # TODO: Implement full submission pipeline
    # from app.cluster.ssh_manager import SSHManager
    # from app.cluster.sftp import SFTPManager
    # from app.cluster.slurm import SlurmManager
    # from app.journal.generator import JournalGenerator

    return {"job_id": job_id, "status": "submitted"}


@celery_app.task(name="app.tasks.job_tasks.poll_active_jobs")
def poll_active_jobs() -> dict:
    """Periodic task: poll SLURM for status of all active (queued/running) jobs.

    For each active job:
    1. Query sacct/squeue for current status.
    2. Update job record in database if status changed.
    3. If completed, trigger result download task.
    4. If failed, update status and store error info.
    """
    logger.info("Polling active jobs...")

    # TODO: Implement polling logic
    # 1. Query DB for jobs with status in (queued, running)
    # 2. For each, check SLURM status via SSH
    # 3. Update DB accordingly

    return {"polled": 0, "updated": 0}


@celery_app.task(name="app.tasks.job_tasks.download_results")
def download_results(job_id: str) -> dict:
    """Download result files from cluster after job completion.

    Steps:
    1. Connect to cluster via SSH/SFTP.
    2. List files in job workspace.
    3. Download forces.csv, residuals.csv, result.cas.h5, screenshots.
    4. Upload to S3 for long-term storage.
    5. Update job record with result file references.
    """
    logger.info("Downloading results for job %s", job_id)

    # TODO: Implement result download pipeline

    return {"job_id": job_id, "files_downloaded": 0}
