"""Core business logic for CFD job lifecycle management."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.geometry import Geometry
from app.models.job import Job, JobStatus
from app.models.user import User
from app.schemas.job import JobCreate


class JobService:
    """Orchestrates job creation, submission, cancellation, and results retrieval."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Create ────────────────────────────────────────────────────────────

    async def create_job(self, user: User, data: JobCreate) -> Job:
        """Validate inputs, persist a draft job, and store the full config."""
        # Verify geometry exists and belongs to user
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

        config = {
            "mesh": data.mesh_config.model_dump(),
            "solver": data.solver_config.model_dump(),
            "slurm": data.slurm_config.model_dump(),
        }

        job = Job(
            user_id=user.id,
            geometry_id=data.geometry_id,
            name=data.name,
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
        2. Generate Fluent journal files (mesh, solver) from config.
        3. Generate SLURM batch script.
        4. Create workspace directory on cluster via SSH.
        5. Upload geometry, journals, and SLURM script via SFTP.
        6. Execute sbatch to submit the job.
        7. Update job record with slurm_job_id, status, timestamps.
        """
        job = await self._get_user_job(user, job_id)

        if job.status != JobStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job is in '{job.status.value}' state; only draft jobs can be submitted",
            )

        workspace = f"{settings.CLUSTER_WORKSPACE_BASE}/{job.id}"
        job.cluster_workspace = workspace

        # TODO: Instantiate JournalGenerator and produce journal files
        # journal_gen = JournalGenerator()
        # mesh_journal = journal_gen.generate_mesh_journal(job.config["mesh"])
        # solver_journal = journal_gen.generate_solver_journal(job.config["solver"])
        # slurm_script = journal_gen.generate_slurm_script(job.config["slurm"])

        # TODO: Instantiate SSHManager, create workspace, upload files
        # ssh = SSHManager()
        # ssh.connect()
        # ssh.execute_command(f"mkdir -p {workspace}")
        # sftp = ssh.open_sftp()
        # ... upload files ...

        # TODO: Submit via sbatch
        # slurm = SlurmManager(ssh)
        # slurm_job_id = slurm.submit_job(f"{workspace}/run.sh")
        # job.slurm_job_id = slurm_job_id

        job.status = JobStatus.queued
        job.submitted_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── Cancel ────────────────────────────────────────────────────────────

    async def cancel_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Cancel a queued or running job on the cluster."""
        job = await self._get_user_job(user, job_id)

        if job.status not in (JobStatus.queued, JobStatus.running):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel a job in '{job.status.value}' state",
            )

        # TODO: Cancel on cluster
        # if job.slurm_job_id:
        #     slurm = SlurmManager(SSHManager())
        #     slurm.cancel_job(job.slurm_job_id)

        job.status = JobStatus.cancelled
        job.completed_at = datetime.now(timezone.utc)
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
        """Retrieve force coefficient data from completed job results.

        TODO: Read forces CSV from cluster workspace or S3, parse and return.
        """
        job = await self._get_user_job(user, job_id)
        if job.status != JobStatus.completed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Force data is only available for completed jobs",
            )
        # Placeholder
        return []

    async def get_residual_data(self, user: User, job_id: uuid.UUID) -> list[dict]:
        """Retrieve residual convergence data from completed job results.

        TODO: Read residuals CSV from cluster workspace or S3, parse and return.
        """
        job = await self._get_user_job(user, job_id)
        if job.status != JobStatus.completed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Residual data is only available for completed jobs",
            )
        # Placeholder
        return []

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
