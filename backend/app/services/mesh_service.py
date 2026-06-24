"""Mesh lifecycle: create, reuse, submit, cancel, sync."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.geometry import Geometry
from app.models.group import GroupMembership
from app.models.mesh import Mesh, MeshStatus
from app.models.user import User
from app.schemas.mesh import MeshCreate
from app.utils.sanitize import sanitize_for_shell, sanitize_path

logger = logging.getLogger(__name__)


def compute_mesh_config_hash(geometry_id: uuid.UUID, mesh_config: dict, cfd_mode: str) -> str:
    """Deterministic sha256 of (geometry_id, cfd_mode, normalized mesh_config).

    Normalization: dict keys sorted, no whitespace. Two structurally identical
    configs produce the same hash even if the caller serialized them differently.
    """
    payload = {
        "geometry_id": str(geometry_id),
        "cfd_mode": cfd_mode,
        "mesh": mesh_config,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class MeshService:
    """Orchestrates mesh creation, reuse, submission, cancellation, sync."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Create / Reuse ────────────────────────────────────────────────────

    async def create_mesh(self, user: User, data: MeshCreate) -> Mesh:
        """Validate inputs, persist a draft mesh."""
        geom = await self.db.execute(
            select(Geometry).where(
                Geometry.id == data.geometry_id,
                Geometry.user_id == user.id,
            )
        )
        geometry = geom.scalar_one_or_none()
        if geometry is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Geometry not found or not owned by you",
            )

        safe_name = sanitize_for_shell(data.name)
        if not safe_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Mesh name contains only unsafe characters",
            )
        sanitize_path(geometry.original_name)

        if data.group_id:
            mem = await self.db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id == data.group_id,
                )
            )
            if mem.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of the selected group",
                )

        # Resolve per-profile mesh/slurm defaults BEFORE hashing so reuse keys on
        # the workflow the job will actually run (watertight vs fault-tolerant).
        from app.schemas.job import (
            apply_cfd_mode_mesh_defaults,
            apply_cfd_mode_slurm_defaults,
        )
        mesh_with_defaults = apply_cfd_mode_mesh_defaults(data.cfd_mode, data.mesh_config)
        slurm_with_defaults = apply_cfd_mode_slurm_defaults(data.cfd_mode, data.slurm_config)

        mesh_dict = mesh_with_defaults.model_dump()
        config_hash = compute_mesh_config_hash(data.geometry_id, mesh_dict, data.cfd_mode)

        output_path = (data.output_path or "/home/<username>/").strip()
        if not output_path.startswith("/"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Output path must be absolute (start with '/')",
            )
        # Allow only safe characters plus the literal "<username>" placeholder.
        if not re.fullmatch(r"[a-zA-Z0-9/\-_.<>]+", output_path):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Output path contains unsafe characters",
            )

        config = {
            "cfd_mode": data.cfd_mode,
            "mesh": mesh_dict,
            "slurm": slurm_with_defaults.model_dump(),
            "output_path": output_path,
        }

        mesh = Mesh(
            user_id=user.id,
            geometry_id=data.geometry_id,
            group_id=data.group_id,
            name=safe_name,
            status=MeshStatus.draft,
            config=config,
            config_hash=config_hash,
        )
        self.db.add(mesh)
        await self.db.flush()
        await self.db.refresh(mesh)
        return mesh

    async def find_reusable_mesh(
        self,
        user: User,
        geometry_id: uuid.UUID,
        mesh_config: dict,
        cfd_mode: str,
    ) -> Mesh | None:
        """Look up a completed mesh owned by the user with a matching config hash.

        Returns None if none exists. Sweeps use this to avoid re-meshing.
        """
        config_hash = compute_mesh_config_hash(geometry_id, mesh_config, cfd_mode)
        result = await self.db.execute(
            select(Mesh)
            .where(
                Mesh.user_id == user.id,
                Mesh.config_hash == config_hash,
                Mesh.status == MeshStatus.completed,
            )
            .order_by(Mesh.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    # ── Submit ────────────────────────────────────────────────────────────

    async def submit_mesh(self, user: User, mesh_id: uuid.UUID) -> Mesh:
        """Move a draft mesh to queued and enqueue the async Celery task."""
        mesh = await self._get_user_mesh(user, mesh_id)

        if mesh.status != MeshStatus.draft:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Mesh is in '{mesh.status.value}' state; only draft meshes can be submitted",
            )

        geom = await self.db.execute(
            select(Geometry).where(Geometry.id == mesh.geometry_id)
        )
        if geom.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Associated geometry no longer exists",
            )

        mesh.status = MeshStatus.queued
        mesh.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        # MUST commit before enqueuing the Celery task. Otherwise the worker
        # (separate process, fresh DB session) opens before this request's
        # transaction commits, sees status='draft', and bails. The API-level
        # get_db() commit fires too late.
        await self.db.commit()
        await self.db.refresh(mesh)

        from app.tasks.mesh_tasks import submit_mesh_to_cluster
        submit_mesh_to_cluster.delay(str(mesh.id))
        logger.info("Mesh %s enqueued for async cluster submission", mesh.id)
        return mesh

    # ── Sync Status ───────────────────────────────────────────────────────

    async def sync_mesh_status(self, user: User, mesh_id: uuid.UUID) -> Mesh:
        """Check SLURM for the real status and update the DB immediately."""
        mesh = await self._get_user_mesh(user, mesh_id)
        if mesh.status not in (MeshStatus.queued, MeshStatus.running):
            return mesh
        if not mesh.slurm_job_id:
            return mesh

        new_status = self._sync_batch_mesh(mesh)
        if new_status and new_status != mesh.status:
            mesh.status = new_status
            if new_status == MeshStatus.running and mesh.started_at is None:
                mesh.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
            if new_status in (MeshStatus.completed, MeshStatus.failed, MeshStatus.cancelled):
                mesh.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                if new_status == MeshStatus.completed:
                    from app.tasks.mesh_tasks import download_mesh_artifact
                    download_mesh_artifact.delay(str(mesh.id))
            await self.db.flush()
            await self.db.refresh(mesh)
        return mesh

    @staticmethod
    def _sync_batch_mesh(mesh: Mesh) -> "MeshStatus | None":
        from app.tasks.job_tasks import _SLURM_STATE_MAP
        from app.models.job import JobStatus

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

            status_info = slurm_mgr.get_job_status(mesh.slurm_job_id)
            raw_state = status_info.get("state", "UNKNOWN").strip()
            # sacct emits "CANCELLED by <uid>" — keep only the verb (AUDIT S6).
            slurm_state = raw_state.split()[0] if raw_state else raw_state
            # Reuse the Job SLURM state map (same enum values).
            job_state = _SLURM_STATE_MAP.get(slurm_state)
            if job_state is None:
                return None
            return MeshStatus(job_state.value)
        except Exception:
            logger.exception("Failed to sync mesh %s", mesh.id)
            return None
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()

    # ── Cancel ────────────────────────────────────────────────────────────

    async def cancel_mesh(self, user: User, mesh_id: uuid.UUID) -> Mesh:
        mesh = await self._get_user_mesh(user, mesh_id)
        if mesh.status not in (MeshStatus.queued, MeshStatus.running):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel a mesh in '{mesh.status.value}' state",
            )

        if mesh.slurm_job_id:
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
                slurm_mgr.cancel_job(mesh.slurm_job_id)
            except Exception:
                logger.warning("Failed to cancel SLURM mesh job %s", mesh.slurm_job_id)
            finally:
                if ssh and not settings.CLUSTER_MOCK_MODE:
                    ssh.close()

        mesh.status = MeshStatus.cancelled
        mesh.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.db.flush()
        await self.db.refresh(mesh)
        return mesh

    # ── Delete ────────────────────────────────────────────────────────────

    async def delete_mesh(self, user: User, mesh_id: uuid.UUID) -> None:
        """Delete a mesh, but only if no solver jobs reference it."""
        mesh = await self._get_user_mesh(user, mesh_id)

        from app.models.job import Job
        count_result = await self.db.execute(
            select(func.count()).select_from(Job).where(Job.mesh_id == mesh.id)
        )
        job_count = count_result.scalar_one()
        if job_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete mesh — {job_count} solver job(s) still reference it",
            )

        await self.db.delete(mesh)
        await self.db.flush()

    # ── Helpers ───────────────────────────────────────────────────────────

    async def _get_user_mesh(
        self, user: User, mesh_id: uuid.UUID, *, allow_group: bool = False
    ) -> Mesh:
        result = await self.db.execute(select(Mesh).where(Mesh.id == mesh_id))
        mesh = result.scalar_one_or_none()
        if mesh is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesh not found")
        if mesh.user_id == user.id:
            return mesh
        if allow_group and mesh.group_id:
            mem = await self.db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id == mesh.group_id,
                )
            )
            if mem.scalar_one_or_none() is not None:
                return mesh
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesh not found")
