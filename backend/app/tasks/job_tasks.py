"""Celery tasks for job lifecycle management."""

from __future__ import annotations

import csv
import io
import logging
import math
import os
import random
import tempfile
import uuid
from datetime import datetime, timezone

import boto3

from app.config import settings
from app.database import SyncSessionLocal
from app.models.job import Job, JobStatus
from app.models.result_file import ResultFile
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

_SLURM_STATE_MAP = {
    "PENDING": JobStatus.queued,
    "RUNNING": JobStatus.running,
    "COMPLETING": JobStatus.running,
    "COMPLETED": JobStatus.completed,
    "FAILED": JobStatus.failed,
    "TIMEOUT": JobStatus.failed,
    "OUT_OF_MEMORY": JobStatus.failed,
    "NODE_FAIL": JobStatus.failed,
    "CANCELLED": JobStatus.cancelled,
    "PREEMPTED": JobStatus.cancelled,
}


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def _get_cluster_managers():
    if settings.CLUSTER_MOCK_MODE:
        from app.cluster.mock import MockSSHManager, MockSlurmManager
        ssh = MockSSHManager()
        return ssh, MockSlurmManager(ssh)
    else:
        from app.cluster.ssh_manager import SSHManager
        from app.cluster.slurm import SlurmManager
        ssh = SSHManager()
        ssh.connect()
        return ssh, SlurmManager(ssh)


@celery_app.task(name="app.tasks.job_tasks.submit_job_to_cluster")
def submit_job_to_cluster(job_id: str) -> dict:
    """Submit a job to the HPC cluster (called from API via .delay())."""
    logger.info("Submitting job %s to cluster", job_id)

    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == uuid.UUID(job_id)).first()
        if not job:
            return {"job_id": job_id, "error": "Job not found"}

        job.status = JobStatus.queued
        job.submitted_at = _utcnow_naive()
        db.commit()

    return {"job_id": job_id, "status": "submitted"}


@celery_app.task(name="app.tasks.job_tasks.poll_active_jobs")
def poll_active_jobs() -> dict:
    """Periodic task: poll SLURM for status of all active jobs."""
    logger.info("Polling active jobs...")

    with SyncSessionLocal() as db:
        active = (
            db.query(Job)
            .filter(Job.status.in_([JobStatus.queued, JobStatus.running]))
            .all()
        )

        if not active:
            return {"polled": 0, "updated": 0}

        ssh = None
        try:
            ssh, slurm_mgr = _get_cluster_managers()

            updated = 0
            for job in active:
                if not job.slurm_job_id:
                    continue

                try:
                    status_info = slurm_mgr.get_job_status(job.slurm_job_id)
                    slurm_state = status_info.get("state", "UNKNOWN").strip()
                    new_status = _SLURM_STATE_MAP.get(slurm_state)

                    if new_status is None:
                        logger.warning(
                            "Unknown SLURM state '%s' for job %s", slurm_state, job.id
                        )
                        continue

                    if new_status != job.status:
                        job.status = new_status
                        if new_status == JobStatus.running and job.started_at is None:
                            job.started_at = _utcnow_naive()
                        if new_status in (JobStatus.completed, JobStatus.failed, JobStatus.cancelled):
                            job.completed_at = _utcnow_naive()
                            if new_status == JobStatus.completed:
                                download_results.delay(str(job.id))
                        updated += 1
                except Exception:
                    logger.exception("Error polling job %s", job.id)

            db.commit()
            return {"polled": len(active), "updated": updated}
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()


@celery_app.task(name="app.tasks.job_tasks.download_results")
def download_results(job_id: str) -> dict:
    """Download result files from cluster after job completion."""
    logger.info("Downloading results for job %s", job_id)

    with SyncSessionLocal() as db:
        job = db.query(Job).filter(Job.id == uuid.UUID(job_id)).first()
        if not job:
            return {"job_id": job_id, "error": "Job not found"}

        if not job.cluster_workspace:
            return {"job_id": job_id, "error": "No cluster workspace set"}

        s3 = _get_s3_client()

        if settings.CLUSTER_MOCK_MODE:
            files_downloaded = _download_mock_results(db, job, s3)
        else:
            files_downloaded = _download_real_results(db, job, s3)

        db.commit()
        return {"job_id": job_id, "files_downloaded": files_downloaded}


def _download_mock_results(db, job: Job, s3) -> int:
    """Generate synthetic CSV data and upload to S3."""
    files_created = 0

    # Generate forces CSV
    forces_csv = _generate_mock_forces_csv(2000)
    forces_key = f"results/{job.id}/forces.csv"
    forces_bytes = forces_csv.encode("utf-8")
    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=forces_key,
        Body=forces_bytes,
        ContentType="text/csv",
    )
    db.add(ResultFile(
        job_id=job.id,
        filename="forces.csv",
        file_type="forces_csv",
        s3_key=forces_key,
        file_size=len(forces_bytes),
    ))
    files_created += 1

    # Generate residuals CSV
    residuals_csv = _generate_mock_residuals_csv(2000)
    residuals_key = f"results/{job.id}/residuals.csv"
    residuals_bytes = residuals_csv.encode("utf-8")
    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=residuals_key,
        Body=residuals_bytes,
        ContentType="text/csv",
    )
    db.add(ResultFile(
        job_id=job.id,
        filename="residuals.csv",
        file_type="residuals_csv",
        s3_key=residuals_key,
        file_size=len(residuals_bytes),
    ))
    files_created += 1

    return files_created


def _download_real_results(db, job: Job, s3) -> int:
    """SFTP result files from cluster and upload to S3."""
    from app.cluster.ssh_manager import SSHManager
    from app.cluster.sftp import SFTPManager

    files_created = 0
    ssh = SSHManager()
    ssh.connect()
    sftp = SFTPManager(ssh.open_sftp())

    known_files = {
        "forces.csv": "forces_csv",
        "residuals.csv": "residuals_csv",
        "result.cas.h5": "case_data",
    }

    try:
        entries = sftp.list_dir(job.cluster_workspace)
        tmpdir = tempfile.mkdtemp(prefix="autoansys_results_")

        for entry in entries:
            fname = entry["name"]
            file_type = known_files.get(fname)
            if file_type is None and not fname.startswith("slurm-"):
                continue
            if file_type is None:
                file_type = "slurm_log"

            remote_path = f"{job.cluster_workspace}/{fname}"
            local_path = os.path.join(tmpdir, fname)
            sftp.download_file(remote_path, local_path)

            file_size = os.path.getsize(local_path)
            s3_key = f"results/{job.id}/{fname}"
            s3.upload_file(local_path, settings.S3_BUCKET, s3_key)

            db.add(ResultFile(
                job_id=job.id,
                filename=fname,
                file_type=file_type,
                s3_key=s3_key,
                file_size=file_size,
            ))
            files_created += 1

        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)
    finally:
        sftp.close()
        ssh.close()

    return files_created


def _generate_mock_forces_csv(iterations: int) -> str:
    """Generate synthetic force coefficient data that looks like convergence."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["iteration", "cd", "cl", "cm"])

    cd_final = 0.32 + random.uniform(-0.02, 0.02)
    cl_final = -2.8 + random.uniform(-0.1, 0.1)
    cm_final = -0.15 + random.uniform(-0.03, 0.03)

    for i in range(1, iterations + 1):
        progress = 1 - math.exp(-i / 300)
        noise = math.exp(-i / 500) * random.uniform(-0.1, 0.1)
        cd = cd_final * progress + noise
        cl = cl_final * progress + noise * 5
        cm = cm_final * progress + noise * 0.5
        writer.writerow([i, f"{cd:.6f}", f"{cl:.6f}", f"{cm:.6f}"])

    return buf.getvalue()


def _generate_mock_residuals_csv(iterations: int) -> str:
    """Generate synthetic residual data showing convergence."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["iteration", "continuity", "x_velocity", "y_velocity", "z_velocity", "k", "omega"])

    for i in range(1, iterations + 1):
        base = max(1e-6, math.exp(-i / 250) * 0.1)
        noise_factor = 1 + random.uniform(-0.3, 0.3)
        writer.writerow([
            i,
            f"{base * noise_factor:.8e}",
            f"{base * 0.8 * noise_factor:.8e}",
            f"{base * 0.7 * noise_factor:.8e}",
            f"{base * 0.9 * noise_factor:.8e}",
            f"{base * 1.2 * noise_factor:.8e}",
            f"{base * 1.1 * noise_factor:.8e}",
        ])

    return buf.getvalue()
