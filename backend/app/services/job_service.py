"""Core business logic for CFD job lifecycle management."""

import csv
import io
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone

import boto3
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.geometry import Geometry
from app.models.job import Job, JobStatus
from app.models.user import User
from app.schemas.job import JobCreate
from app.utils.sanitize import sanitize_for_shell, sanitize_path

logger = logging.getLogger(__name__)


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


def _get_cluster_managers():
    """Return SSH and SLURM manager instances based on mock mode."""
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


class JobService:
    """Orchestrates job creation, submission, cancellation, and results retrieval."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Create ────────────────────────────────────────────────────────────

    async def create_job(self, user: User, data: JobCreate) -> Job:
        """Validate inputs, persist a draft job, and store the full config."""
        result = await self.db.execute(
            select(Geometry).where(
                Geometry.id == data.geometry_id,
                Geometry.user_id == user.id,
            )
        )
        geometry = result.scalar_one_or_none()
        if geometry is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Geometry not found or not owned by you",
            )

        safe_name = sanitize_for_shell(data.name)
        if not safe_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Job name contains only unsafe characters",
            )

        sanitize_path(geometry.original_name)

        config = {
            "mesh": data.mesh_config.model_dump(),
            "solver": data.solver_config.model_dump(),
            "slurm": data.slurm_config.model_dump(),
        }

        job = Job(
            user_id=user.id,
            geometry_id=data.geometry_id,
            name=safe_name,
            status=JobStatus.draft,
            config=config,
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── Submit ────────────────────────────────────────────────────────────

    async def submit_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Submit a draft job to the HPC cluster.

        Full flow:
        1. Load job, verify ownership and draft status.
        2. Download geometry from S3.
        3. Generate Fluent journal files (mesh, solver) from config.
        4. Generate SLURM batch script.
        5. Create workspace directory on cluster via SSH.
        6. Upload geometry, journals, and SLURM script via SFTP.
        7. Execute sbatch to submit the job.
        8. Update job record with slurm_job_id, status, timestamps.
        """
        job = await self._get_user_job(user, job_id)

        if job.status != JobStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job is in '{job.status.value}' state; only draft jobs can be submitted",
            )

        geom_result = await self.db.execute(
            select(Geometry).where(Geometry.id == job.geometry_id)
        )
        geometry = geom_result.scalar_one_or_none()
        if geometry is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated geometry no longer exists",
            )

        workspace = f"{settings.CLUSTER_WORKSPACE_BASE}/{job.id}"
        job.cluster_workspace = workspace
        geom_filename = sanitize_path(geometry.original_name) or "geometry.stp"

        tmpdir = None
        ssh = None
        try:
            # 1. Download geometry from S3 to a temp file
            tmpdir = tempfile.mkdtemp(prefix="autoansys_")
            local_geom_path = os.path.join(tmpdir, geom_filename)

            s3 = _get_s3_client()
            s3.download_file(settings.S3_BUCKET, geometry.s3_key, local_geom_path)

            # 2. Generate journal files
            from app.journal.generator import JournalGenerator
            gen = JournalGenerator()

            mesh_jou = gen.generate_mesh_journal(
                job.config["mesh"],
                geometry_file=f"{workspace}/{geom_filename}",
                output_case=f"{workspace}/result.cas.h5",
            )
            solver_jou = gen.generate_solver_journal(
                job.config["solver"],
                case_file=f"{workspace}/result.cas.h5",
                workspace=workspace,
            )
            slurm_sh = gen.generate_slurm_script(
                job.config["slurm"],
                workspace=workspace,
                fluent_module=settings.FLUENT_MODULE,
            )

            # 3. Connect to cluster
            ssh, slurm_mgr = _get_cluster_managers()

            # 4. Create workspace and upload files
            from app.cluster.sftp import SFTPManager
            sftp_client = ssh.open_sftp()
            sftp = SFTPManager(sftp_client)

            sftp.upload_file(local_geom_path, f"{workspace}/{geom_filename}")
            sftp.upload_string(mesh_jou, f"{workspace}/mesh_watertight.jou")
            sftp.upload_string(solver_jou, f"{workspace}/solver.jou")
            sftp.upload_string(slurm_sh, f"{workspace}/run.sh")
            sftp.close()

            # 5. Submit via sbatch
            slurm_job_id = slurm_mgr.submit_job(f"{workspace}/run.sh")
            job.slurm_job_id = slurm_job_id

            job.status = JobStatus.queued
            job.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
            await self.db.refresh(job)

            logger.info("Job %s submitted with SLURM ID %s", job.id, slurm_job_id)
            return job

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to submit job %s", job_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Job submission failed: {exc}",
            )
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()
            if tmpdir:
                import shutil
                shutil.rmtree(tmpdir, ignore_errors=True)

    # ── Cancel ────────────────────────────────────────────────────────────

    async def cancel_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Cancel a queued or running job on the cluster."""
        job = await self._get_user_job(user, job_id)

        if job.status not in (JobStatus.queued, JobStatus.running):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel a job in '{job.status.value}' state",
            )

        if job.slurm_job_id:
            ssh = None
            try:
                ssh, slurm_mgr = _get_cluster_managers()
                slurm_mgr.cancel_job(job.slurm_job_id)
            except Exception:
                logger.warning("Failed to cancel SLURM job %s on cluster", job.slurm_job_id)
            finally:
                if ssh and not settings.CLUSTER_MOCK_MODE:
                    ssh.close()

        job.status = JobStatus.cancelled
        job.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── Resubmit ──────────────────────────────────────────────────────────

    async def resubmit_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Clone a completed or failed job and submit the clone."""
        original = await self._get_user_job(user, job_id)

        new_job = Job(
            user_id=user.id,
            geometry_id=original.geometry_id,
            name=f"{original.name} (resubmit)",
            status=JobStatus.draft,
            config=original.config,
        )
        self.db.add(new_job)
        await self.db.flush()
        await self.db.refresh(new_job)
        return new_job

    # ── Results ───────────────────────────────────────────────────────────

    async def get_force_data(self, user: User, job_id: uuid.UUID) -> list[dict]:
        """Retrieve force coefficient data from completed job results."""
        job = await self._get_user_job(user, job_id)
        if job.status != JobStatus.completed:
            return []

        from app.models.result_file import ResultFile
        result = await self.db.execute(
            select(ResultFile).where(
                ResultFile.job_id == job.id,
                ResultFile.file_type == "forces_csv",
            )
        )
        rf = result.scalar_one_or_none()
        if rf is None:
            return []

        return self._parse_forces_csv(rf.s3_key)

    async def get_residual_data(self, user: User, job_id: uuid.UUID) -> list[dict]:
        """Retrieve residual convergence data from completed job results."""
        job = await self._get_user_job(user, job_id)
        if job.status != JobStatus.completed:
            return []

        from app.models.result_file import ResultFile
        result = await self.db.execute(
            select(ResultFile).where(
                ResultFile.job_id == job.id,
                ResultFile.file_type == "residuals_csv",
            )
        )
        rf = result.scalar_one_or_none()
        if rf is None:
            return []

        return self._parse_residuals_csv(rf.s3_key)

    def _parse_forces_csv(self, s3_key: str) -> list[dict]:
        """Download forces CSV from S3 and parse into ForceReport dicts."""
        s3 = _get_s3_client()
        obj = s3.get_object(Bucket=settings.S3_BUCKET, Key=s3_key)
        body = obj["Body"].read().decode("utf-8")
        reader = csv.DictReader(io.StringIO(body))
        rows = []
        for row in reader:
            try:
                rows.append({
                    "iteration": int(row.get("iteration", 0)),
                    "cd": float(row.get("cd", 0)),
                    "cl": float(row.get("cl", 0)),
                    "cm": float(row.get("cm", 0)),
                })
            except (ValueError, KeyError):
                continue
        return rows

    def _parse_residuals_csv(self, s3_key: str) -> list[dict]:
        """Download residuals CSV from S3 and parse into ResidualData dicts."""
        s3 = _get_s3_client()
        obj = s3.get_object(Bucket=settings.S3_BUCKET, Key=s3_key)
        body = obj["Body"].read().decode("utf-8")
        reader = csv.DictReader(io.StringIO(body))
        rows = []
        for row in reader:
            try:
                rows.append({
                    "iteration": int(row.get("iteration", 0)),
                    "continuity": float(row.get("continuity", 0)),
                    "x_velocity": float(row.get("x_velocity", 0)),
                    "y_velocity": float(row.get("y_velocity", 0)),
                    "z_velocity": float(row.get("z_velocity", 0)),
                    "k": float(row.get("k", 0)),
                    "omega": float(row.get("omega", 0)),
                })
            except (ValueError, KeyError):
                continue
        return rows

    # ── Helpers ───────────────────────────────────────────────────────────

    async def _get_user_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Fetch a job and verify ownership."""
        result = await self.db.execute(
            select(Job).where(Job.id == job_id, Job.user_id == user.id)
        )
        job = result.scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )
        return job
