"""Core business logic for FEA job lifecycle management."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cluster.sftp import SFTPManager
from app.cluster.slurm import SlurmManager
from app.cluster.ssh_manager import SSHManager
from app.config import settings
from app.fea.input_generator import generate_calculix_input
from app.fea.result_parser import parse_dat_results
from app.fea.slurm_generator import generate_slurm_script
from app.models.fea_job import FEAJob, FEAJobStatus
from app.models.user import User
from app.schemas.fea import FEASubmitPayload

logger = logging.getLogger(__name__)


class FEAService:
    """Orchestrates FEA job creation, submission, and results retrieval."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Submit ────────────────────────────────────────────────────────────

    async def submit_job(self, user: User, payload: FEASubmitPayload) -> FEAJob:
        """Validate inputs, generate files, submit to ARC, return the job record."""

        job = FEAJob(
            user_id=user.id,
            job_name=payload.job_name,
            status=FEAJobStatus.pending.value,
            mesh_file_id=payload.mesh_file_id,
            mesh_file_name=payload.mesh_file_name,
            material_json=payload.material.model_dump(),
            constraints_json=[c.model_dump() for c in payload.constraints],
            loads_json=[ld.model_dump() for ld in payload.loads],
            arc_settings_json=payload.arc.model_dump(),
        )

        inp_content = generate_calculix_input(
            job_name=payload.job_name,
            mesh_filename=payload.mesh_file_name or "mesh.inp",
            material=payload.material.model_dump(),
            constraints=[c.model_dump() for c in payload.constraints],
            loads=[ld.model_dump() for ld in payload.loads],
        )

        slurm_content = generate_slurm_script(
            job_id=str(job.id),
            job_name=payload.job_name,
            arc_settings=payload.arc.model_dump(),
            work_dir=settings.FEA_WORK_DIR,
            solver=settings.FEA_SOLVER,
            solver_module=settings.FEA_SOLVER_MODULE,
        )
        job.slurm_script = slurm_content

        workspace = f"{settings.FEA_WORK_DIR}/{job.id}"
        job.cluster_workspace = workspace

        try:
            with SSHManager() as ssh:
                ssh.execute_command(f"mkdir -p {workspace}")
                sftp_client = ssh.open_sftp()
                sftp = SFTPManager(sftp_client)
                try:
                    sftp.upload_string(inp_content, f"{workspace}/{payload.job_name}.inp")
                    sftp.upload_string(slurm_content, f"{workspace}/run.sh")
                    # TODO: download mesh from S3 by mesh_file_id and upload to workspace
                finally:
                    sftp.close()

                slurm = SlurmManager(ssh)
                slurm_job_id = slurm.submit_job(f"{workspace}/run.sh")
                job.slurm_job_id = slurm_job_id
                job.status = FEAJobStatus.queued.value
        except Exception as exc:
            logger.error("FEA submission failed: %s", exc)
            job.status = FEAJobStatus.failed.value

        self.db.add(job)
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── List ──────────────────────────────────────────────────────────────

    async def list_jobs(
        self, user: User, skip: int = 0, limit: int = 50
    ) -> tuple[list[FEAJob], int]:
        query = (
            select(FEAJob)
            .where(FEAJob.user_id == user.id)
            .order_by(FEAJob.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        count_q = select(func.count()).select_from(FEAJob).where(FEAJob.user_id == user.id)
        result = await self.db.execute(query)
        items = list(result.scalars().all())
        total = (await self.db.execute(count_q)).scalar() or 0
        return items, total

    # ── Get ───────────────────────────────────────────────────────────────

    async def get_job(self, user: User, job_id: uuid.UUID) -> FEAJob:
        result = await self.db.execute(
            select(FEAJob).where(FEAJob.id == job_id, FEAJob.user_id == user.id)
        )
        job = result.scalar_one_or_none()
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="FEA job not found"
            )
        return job

    # ── Status ────────────────────────────────────────────────────────────

    async def get_status(self, user: User, job_id: uuid.UUID) -> FEAJob:
        job = await self.get_job(user, job_id)
        if job.slurm_job_id and job.status in (
            FEAJobStatus.queued.value,
            FEAJobStatus.running.value,
            FEAJobStatus.pending.value,
        ):
            try:
                with SSHManager() as ssh:
                    slurm = SlurmManager(ssh)
                    info = slurm.get_job_status(job.slurm_job_id)
                    state = info.get("state", "").upper()
                    if "RUNNING" in state:
                        job.status = FEAJobStatus.running.value
                    elif "COMPLETED" in state:
                        job.status = FEAJobStatus.completed.value
                        await self._fetch_results(job, ssh)
                    elif "FAILED" in state or "TIMEOUT" in state or "NODE_FAIL" in state:
                        job.status = FEAJobStatus.failed.value
                    elif "CANCELLED" in state:
                        job.status = FEAJobStatus.cancelled.value
                    await self.db.flush()
                    await self.db.refresh(job)
            except Exception as exc:
                logger.warning("Failed to poll SLURM status for FEA job %s: %s", job_id, exc)
        return job

    # ── Results ───────────────────────────────────────────────────────────

    async def get_results(self, user: User, job_id: uuid.UUID) -> FEAJob:
        job = await self.get_job(user, job_id)
        if job.status != FEAJobStatus.completed.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Results are only available for completed FEA jobs",
            )
        return job

    # ── Log ───────────────────────────────────────────────────────────────

    async def get_log(self, user: User, job_id: uuid.UUID) -> str:
        job = await self.get_job(user, job_id)
        if not job.cluster_workspace:
            return ""
        try:
            with SSHManager() as ssh:
                out, _, _ = ssh.execute_command(
                    f"cat {job.cluster_workspace}/*.out 2>/dev/null | tail -200"
                )
                return out
        except Exception as exc:
            logger.warning("Failed to fetch FEA log for job %s: %s", job_id, exc)
            return ""

    # ── Cancel ────────────────────────────────────────────────────────────

    async def cancel_job(self, user: User, job_id: uuid.UUID) -> FEAJob:
        job = await self.get_job(user, job_id)
        if job.status not in (
            FEAJobStatus.pending.value,
            FEAJobStatus.queued.value,
            FEAJobStatus.running.value,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel FEA job in '{job.status}' state",
            )
        if job.slurm_job_id:
            try:
                with SSHManager() as ssh:
                    slurm = SlurmManager(ssh)
                    slurm.cancel_job(job.slurm_job_id)
            except Exception as exc:
                logger.warning("Failed to scancel FEA job %s: %s", job_id, exc)

        job.status = FEAJobStatus.cancelled.value
        await self.db.flush()
        await self.db.refresh(job)
        return job

    # ── Internal ──────────────────────────────────────────────────────────

    async def _fetch_results(self, job: FEAJob, ssh: SSHManager) -> None:
        """Attempt to read and parse .dat results from the cluster workspace."""
        if not job.cluster_workspace:
            return
        try:
            dat_path = f"{job.cluster_workspace}/{job.job_name}.dat"
            out, err, code = ssh.execute_command(f"cat {dat_path}")
            if code == 0 and out:
                yield_pa = None
                mat = job.material_json or {}
                if mat.get("yield_strength"):
                    yield_pa = mat["yield_strength"]
                summary = parse_dat_results(out, yield_pa)
                job.summary_json = summary

            frd_path = f"{job.cluster_workspace}/{job.job_name}.frd"
            job.output_files_json = [
                {"name": f"{job.job_name}.frd", "url": f"/api/fea/download/{job.id}/{job.job_name}.frd"},
                {"name": f"{job.job_name}.dat", "url": f"/api/fea/download/{job.id}/{job.job_name}.dat"},
            ]
        except Exception as exc:
            logger.warning("Failed to parse FEA results for job %s: %s", job.id, exc)
