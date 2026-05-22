"""Core business logic for CFD job lifecycle management."""

import csv
import io
import logging
import uuid
from datetime import datetime, timezone

import boto3
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.geometry import Geometry
from app.models.group import Group, GroupMembership
from app.models.job import Job, JobStatus
from app.models.user import User
from app.schemas.job import JobCreate, apply_cfd_mode_defaults
from app.utils.sanitize import sanitize_for_shell, sanitize_path

logger = logging.getLogger(__name__)


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    )


class JobService:
    """Orchestrates job creation, submission, cancellation, and results retrieval."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Create ────────────────────────────────────────────────────────────

    async def create_job(self, user: User, data: JobCreate) -> Job:
        """Validate inputs, persist a draft job, and store the full config.

        If ``data.mesh_id`` is provided, the job runs as a solver-from-case job
        against that Mesh. Otherwise, if the caller supplied a ``mesh_config``
        that matches an existing completed mesh by hash, we auto-bind to that
        mesh (sweep reuse). Otherwise the job uses the legacy combined journal.
        """
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

        if data.group_id:
            membership = await self.db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id == data.group_id,
                )
            )
            if membership.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of the selected group",
                )

        # Resolve mesh_id — explicit binding takes priority, else try reuse by hash.
        bound_mesh_id = None
        if data.mesh_id is not None:
            from app.models.mesh import Mesh, MeshStatus
            mres = await self.db.execute(select(Mesh).where(Mesh.id == data.mesh_id))
            mesh = mres.scalar_one_or_none()
            if mesh is None or mesh.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Mesh not found or not owned by you",
                )
            if mesh.status != MeshStatus.completed:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Mesh is '{mesh.status.value}'; must be completed before attaching to a job",
                )
            if mesh.geometry_id != data.geometry_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Mesh was built from a different geometry",
                )
            bound_mesh_id = mesh.id
        else:
            from app.services.mesh_service import MeshService
            mesh_service = MeshService(self.db)
            reusable = await mesh_service.find_reusable_mesh(
                user=user,
                geometry_id=data.geometry_id,
                mesh_config=data.mesh_config.model_dump(),
                cfd_mode=data.cfd_mode,
            )
            if reusable is not None:
                bound_mesh_id = reusable.id
                logger.info(
                    "Auto-bound job to reusable mesh %s (config-hash match)",
                    reusable.id,
                )

        # Apply per-mode SOP defaults — fills BCs / iter count / ref area if
        # the wizard didn't already (e.g. API-direct callers, sweep clones).
        solver_with_defaults = apply_cfd_mode_defaults(data.cfd_mode, data.solver_config)
        config = {
            "cfd_mode": data.cfd_mode,
            "mesh": data.mesh_config.model_dump(),
            "solver": solver_with_defaults.model_dump(),
            "slurm": data.slurm_config.model_dump(),
        }

        job = Job(
            user_id=user.id,
            geometry_id=data.geometry_id,
            name=safe_name,
            status=JobStatus.draft,
            config=config,
            group_id=data.group_id,
            mesh_id=bound_mesh_id,
        )
        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── Submit ────────────────────────────────────────────────────────────

    async def submit_job(self, user: User, job_id: uuid.UUID) -> Job:
        """Validate a draft job and enqueue it for async cluster submission.

        The heavy lifting (S3 download, journal generation, SFTP upload,
        sbatch) runs in a Celery worker so the API returns immediately.
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
        if geom_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated geometry no longer exists",
            )

        job.status = JobStatus.queued
        job.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        # MUST commit before enqueuing the Celery task. Otherwise the worker
        # opens its own DB session, sees status='draft' (the API-level commit
        # in get_db() hasn't fired yet), and aborts with a state mismatch.
        await self.db.commit()
        await self.db.refresh(job)

        from app.tasks.job_tasks import submit_job_to_cluster
        submit_job_to_cluster.delay(str(job.id))

        logger.info("Job %s enqueued for async cluster submission", job.id)
        return job

    # ── Sync Status ───────────────────────────────────────────────────────

    async def sync_job_status(self, user: User, job_id: uuid.UUID) -> Job:
        """Check the cluster for the real status and update the DB immediately.

        For batch jobs: queries sacct.
        For session jobs: checks if PID is still alive.
        Returns the (possibly updated) job.
        """
        job = await self._get_user_job(user, job_id)

        # Only sync jobs in active states
        if job.status not in (JobStatus.queued, JobStatus.running):
            return job

        if not job.slurm_job_id:
            return job

        is_session = job.slurm_job_id.startswith("session:")

        if is_session:
            new_status = self._sync_session_job(job)
        else:
            new_status = self._sync_batch_job(job)

        if new_status and new_status != job.status:
            job.status = new_status
            if new_status == JobStatus.running and job.started_at is None:
                job.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
            if new_status in (JobStatus.completed, JobStatus.failed, JobStatus.cancelled):
                job.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                if new_status == JobStatus.completed:
                    from app.tasks.job_tasks import download_results
                    download_results.delay(str(job.id))
            await self.db.flush()
            await self.db.refresh(job)

        return job

    @staticmethod
    def _sync_batch_job(job: Job) -> "JobStatus | None":
        """Query sacct for the real SLURM state of a batch job."""
        from app.tasks.job_tasks import _SLURM_STATE_MAP

        ssh = None
        try:
            if settings.CLUSTER_MOCK_MODE:
                from app.cluster.mock import MockSSHManager, MockSlurmManager
                ssh = MockSSHManager()
                slurm_mgr = MockSlurmManager(ssh)
            else:
                from app.cluster.ssh_manager import SSHManager
                from app.cluster.slurm import SlurmManager
                ssh = SSHManager()
                ssh.connect()
                slurm_mgr = SlurmManager(ssh)

            status_info = slurm_mgr.get_job_status(job.slurm_job_id)
            raw_state = status_info.get("state", "UNKNOWN").strip()
            return _SLURM_STATE_MAP.get(raw_state)
        except Exception:
            logger.exception("Failed to sync batch job %s", job.id)
            return None
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()

    @staticmethod
    def _sync_session_job(job: Job) -> "JobStatus | None":
        """Check if the session Fluent process is still alive."""
        if not job.slurm_job_id or not job.slurm_job_id.startswith("session:"):
            return None
        try:
            rest = job.slurm_job_id[len("session:"):]
            pid_str, compute_node = rest.split("@", 1)
            pid = int(pid_str)
        except (ValueError, IndexError):
            return None

        session_ssh = None
        try:
            if settings.CLUSTER_MOCK_MODE:
                from app.cluster.mock import MockSessionSSHManager
                session_ssh = MockSessionSSHManager(compute_node)
            else:
                from app.cluster.session import SessionSSHManager
                session_ssh = SessionSSHManager(compute_node)

            session_ssh.connect()

            if session_ssh.is_pid_alive(pid):
                return None  # still running

            workspace = job.cluster_workspace or ""
            out, _, _ = session_ssh.execute_command(
                f"ls {workspace}/result.cas.h5 2>/dev/null && echo FOUND || echo NOTFOUND"
            )
            return JobStatus.completed if "FOUND" in out else JobStatus.failed
        except Exception:
            logger.exception("Failed to sync session job %s", job.id)
            return None
        finally:
            if session_ssh:
                session_ssh.close()

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
                if settings.CLUSTER_MOCK_MODE:
                    from app.cluster.mock import MockSSHManager, MockSlurmManager
                    ssh = MockSSHManager()
                    slurm_mgr = MockSlurmManager(ssh)
                else:
                    from app.cluster.ssh_manager import SSHManager
                    from app.cluster.slurm import SlurmManager
                    ssh = SSHManager()
                    ssh.connect()
                    slurm_mgr = SlurmManager(ssh)
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
        job = await self._get_user_job(user, job_id, allow_group=True)
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
        job = await self._get_user_job(user, job_id, allow_group=True)
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

    async def _get_user_job(self, user: User, job_id: uuid.UUID, *, allow_group: bool = False) -> Job:
        """Fetch a job and verify ownership or group membership."""
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )
        if job.user_id == user.id:
            return job

        if allow_group and job.group_id:
            mem = await self.db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id == job.group_id,
                )
            )
            if mem.scalar_one_or_none() is not None:
                return job

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
