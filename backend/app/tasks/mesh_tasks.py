"""Celery tasks for Mesh lifecycle management (split workflow Phase 1)."""

from __future__ import annotations

import logging
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone

import boto3
import redis as sync_redis

from app.config import settings
from app.database import SyncSessionLocal
from app.models.mesh import Mesh, MeshStatus
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


_MESH_SLURM_STATE_MAP = {
    "PENDING": MeshStatus.queued,
    "RUNNING": MeshStatus.running,
    "COMPLETING": MeshStatus.running,
    "COMPLETED": MeshStatus.completed,
    "FAILED": MeshStatus.failed,
    "TIMEOUT": MeshStatus.failed,
    "OUT_OF_MEMORY": MeshStatus.failed,
    "NODE_FAIL": MeshStatus.failed,
    "CANCELLED": MeshStatus.cancelled,
    "PREEMPTED": MeshStatus.cancelled,
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


def _publish_mesh_event(mesh_id: str, event_type: str, data: dict) -> None:
    """Real-time event publisher for mesh status updates."""
    try:
        r = sync_redis.from_url(settings.REDIS_URL)
        r.publish(
            f"mesh:{mesh_id}:events",
            __import__("json").dumps({"type": event_type, "data": data}),
        )
        r.close()
    except Exception:
        logger.debug("Failed to publish event for mesh %s", mesh_id)


# ── Submit ─────────────────────────────────────────────────────────────────


@celery_app.task(name="app.tasks.mesh_tasks.submit_mesh_to_cluster", bind=True, max_retries=2)
def submit_mesh_to_cluster(self, mesh_id: str) -> dict:
    """Submit a queued mesh to the HPC cluster.

    Pipeline: S3 download of geometry → mesh-only journal gen → SFTP → sbatch.
    The resulting mesh.cas.h5 is the single artifact consumed by downstream
    solver jobs (via Mesh.case_file_s3_key after download).
    """
    logger.info("Submitting mesh %s to cluster", mesh_id)

    with SyncSessionLocal() as db:
        from app.models.geometry import Geometry

        mesh = db.query(Mesh).filter(Mesh.id == uuid.UUID(mesh_id)).first()
        if not mesh:
            return {"mesh_id": mesh_id, "error": "Mesh not found"}

        if mesh.status == MeshStatus.draft:
            # Enqueue-before-commit race: API committed too late, this worker
            # opened a session before the status flip was visible. Retry with
            # a short delay; the API-level commit will be visible by then.
            logger.warning(
                "Mesh %s still in draft — retrying in 2s (commit-race)", mesh_id,
            )
            raise self.retry(countdown=2, max_retries=3)

        if mesh.status != MeshStatus.queued:
            return {
                "mesh_id": mesh_id,
                "error": f"Mesh is in '{mesh.status.value}' state, expected queued",
            }

        geometry = db.query(Geometry).filter(Geometry.id == mesh.geometry_id).first()
        if not geometry:
            mesh.status = MeshStatus.failed
            db.commit()
            _publish_mesh_event(mesh_id, "status_update", {"status": "failed"})
            return {"mesh_id": mesh_id, "error": "Geometry not found"}

        workspace = f"{settings.CLUSTER_WORKSPACE_BASE}/mesh_{mesh.id}"
        mesh.cluster_workspace = workspace

        from app.utils.sanitize import sanitize_path
        geom_filename = sanitize_path(geometry.original_name) or "geometry.stp"

        ssh = None
        tmpdir = None
        try:
            tmpdir = tempfile.mkdtemp(prefix="autoansys_mesh_")
            local_geom_path = os.path.join(tmpdir, geom_filename)
            s3 = _get_s3_client()
            s3.download_file(settings.S3_BUCKET, geometry.s3_key, local_geom_path)

            from app.journal.generator import JournalGenerator
            gen = JournalGenerator()

            mesh_jou = gen.generate_mesh_journal(
                mesh_config=mesh.config["mesh"],
                geometry_file=f"{workspace}/{geom_filename}",
                workspace=workspace,
                cfd_mode=mesh.config.get("cfd_mode", "individual_part"),
            )
            # Give the mesh job a distinct SLURM job_name so it's easy to spot
            # in squeue vs. a solver job. Meshing is also typically shorter, so
            # fall back to 6h walltime if the user didn't override.
            slurm_cfg = dict(mesh.config.get("slurm", {}))
            slurm_cfg.setdefault("job_name", f"autoansys_mesh_{str(mesh.id)[:8]}")
            slurm_cfg.setdefault("walltime_hours", 6)
            # Watertight meshing is dominated by single-threaded stages
            # (surface wrap, intersect, label propagation). Past ~16 cores
            # MPI coordination overhead makes wall-clock *worse*, not better.
            # Cap meshing core count regardless of what the user requested.
            user_cores = int(slurm_cfg.get("cores_per_node") or 16)
            slurm_cfg["cores_per_node"] = min(user_cores, 16)
            slurm_cfg["nodes"] = 1  # meshing is single-node only
            slurm_sh = gen.generate_slurm_script(
                slurm_cfg,
                workspace=workspace,
                fluent_module=settings.FLUENT_MODULE,
            )

            ssh, slurm_mgr = _get_cluster_managers()

            from app.cluster.sftp import SFTPManager
            sftp_client = ssh.open_sftp()
            sftp = SFTPManager(sftp_client)

            sftp.upload_file(local_geom_path, f"{workspace}/{geom_filename}")
            sftp.upload_string(mesh_jou, f"{workspace}/autoansys.jou")
            sftp.upload_string(slurm_sh, f"{workspace}/run.sh")
            sftp.close()

            slurm_job_id = slurm_mgr.submit_job(f"{workspace}/run.sh")
            mesh.slurm_job_id = slurm_job_id
            db.commit()

            _publish_mesh_event(mesh_id, "status_update", {
                "status": "queued",
                "slurm_job_id": slurm_job_id,
            })

            logger.info("Mesh %s submitted with SLURM ID %s", mesh.id, slurm_job_id)
            return {"mesh_id": mesh_id, "slurm_job_id": slurm_job_id, "status": "queued"}

        except Exception as exc:
            logger.exception("Failed to submit mesh %s", mesh_id)
            mesh.status = MeshStatus.failed
            mesh.completed_at = _utcnow_naive()
            db.commit()
            _publish_mesh_event(mesh_id, "status_update", {"status": "failed"})
            return {"mesh_id": mesh_id, "error": str(exc)}
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()
            if tmpdir:
                import shutil
                shutil.rmtree(tmpdir, ignore_errors=True)


# ── Poll ───────────────────────────────────────────────────────────────────


@celery_app.task(name="app.tasks.mesh_tasks.poll_active_meshes")
def poll_active_meshes() -> dict:
    """Periodic task: sync SLURM state for meshes in queued/running."""
    logger.info("Polling active meshes...")

    with SyncSessionLocal() as db:
        active = (
            db.query(Mesh)
            .filter(Mesh.status.in_([MeshStatus.queued, MeshStatus.running]))
            .all()
        )
        if not active:
            return {"polled": 0, "updated": 0}

        ssh = None
        try:
            ssh, slurm_mgr = _get_cluster_managers()

            updated = 0
            for mesh in active:
                if not mesh.slurm_job_id:
                    continue

                try:
                    status_info = slurm_mgr.get_job_status(mesh.slurm_job_id)
                    raw_state = status_info.get("state", "UNKNOWN").strip()
                    new_status = _MESH_SLURM_STATE_MAP.get(raw_state)

                    if new_status is None:
                        logger.warning(
                            "Unknown SLURM state '%s' for mesh %s", raw_state, mesh.id
                        )
                        continue

                    if new_status != mesh.status:
                        mesh.status = new_status
                        event_data: dict = {"status": new_status.value}
                        if new_status == MeshStatus.running and mesh.started_at is None:
                            mesh.started_at = _utcnow_naive()
                            event_data["started_at"] = mesh.started_at.isoformat()
                        if new_status in (
                            MeshStatus.completed, MeshStatus.failed, MeshStatus.cancelled
                        ):
                            mesh.completed_at = _utcnow_naive()
                            event_data["completed_at"] = mesh.completed_at.isoformat()
                            if new_status == MeshStatus.completed:
                                download_mesh_artifact.delay(str(mesh.id))
                        _publish_mesh_event(str(mesh.id), "status_update", event_data)
                        updated += 1
                except Exception:
                    logger.exception("Error polling mesh %s", mesh.id)

            db.commit()
            return {"polled": len(active), "updated": updated}
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()


# ── Download ───────────────────────────────────────────────────────────────


# Fluent 2025R1 /mesh/size-info actually emits a columnar table:
#
#     Level    Cells    Faces    Nodes   Partitions
#         0  2505575 12930707  8968379           16
#      2 cell zones, 6 face zones.
#
# Older versions used a colon form ("Total cell count: 9841203"). Support
# both: try the columnar header→next-row pattern first, fall back to the
# colon form, fall back to a plain "<N> cells, ..." summary line.
_CELL_COUNT_COLUMN_RE = re.compile(
    r"Level\s+Cells\s+Faces\s+Nodes\s+Partitions\s*\n\s*\d+\s+(\d[\d,]*)",
    re.IGNORECASE,
)
_CELL_COUNT_LABELED_RE = re.compile(
    r"(?:total\s+cell\s+count|all\s+cell\s+zones)\s*[:\s]+(\d[\d,]*)",
    re.IGNORECASE,
)
_CELL_COUNT_SUMMARY_RE = re.compile(
    r"(\d[\d,]*)\s+cells,\s+\d",
    re.IGNORECASE,
)


def _parse_cell_count(fluent_log: str) -> int | None:
    """Extract total cell count from the /mesh/size-info output in fluent.log."""
    # Narrow to between the MESH_CELL_COUNT_BEGIN / END markers if present.
    begin = fluent_log.find("MESH_CELL_COUNT_BEGIN")
    end = fluent_log.find("MESH_CELL_COUNT_END")
    window = fluent_log[begin:end] if begin != -1 and end != -1 and end > begin else fluent_log

    for pattern in (_CELL_COUNT_COLUMN_RE, _CELL_COUNT_LABELED_RE, _CELL_COUNT_SUMMARY_RE):
        m = pattern.search(window)
        if m:
            try:
                return int(m.group(1).replace(",", ""))
            except ValueError:
                continue
    return None


@celery_app.task(name="app.tasks.mesh_tasks.download_mesh_artifact")
def download_mesh_artifact(mesh_id: str) -> dict:
    """After the mesh SLURM job completes, pull mesh.cas.h5 off the cluster,
    push it to S3, parse the cell count from fluent.log, and record timings.
    """
    logger.info("Downloading mesh artifact for %s", mesh_id)

    with SyncSessionLocal() as db:
        mesh = db.query(Mesh).filter(Mesh.id == uuid.UUID(mesh_id)).first()
        if not mesh:
            return {"mesh_id": mesh_id, "error": "Mesh not found"}
        if not mesh.cluster_workspace:
            return {"mesh_id": mesh_id, "error": "No cluster workspace set"}

        s3 = _get_s3_client()
        s3_key = f"meshes/{mesh.id}/mesh.cas.h5"

        try:
            output_path = (mesh.config or {}).get("output_path")
            if output_path:
                output_path = output_path.replace("<username>", settings.CLUSTER_USER)

            if settings.CLUSTER_MOCK_MODE:
                # Mock: no real case file, just mark the key and a fake cell count
                # so the UI has something to show.
                mesh.case_file_s3_key = s3_key
                mesh.cell_count = 1_500_000
            else:
                from app.cluster.ssh_manager import SSHManager
                from app.cluster.sftp import SFTPManager

                ssh = SSHManager()
                ssh.connect()
                sftp = SFTPManager(ssh.open_sftp())

                tmpdir = tempfile.mkdtemp(prefix="autoansys_mesh_dl_")
                try:
                    # Pull the case file.
                    local_case = os.path.join(tmpdir, "mesh.cas.h5")
                    remote_case = f"{mesh.cluster_workspace}/mesh.cas.h5"
                    sftp.download_file(remote_case, local_case)
                    s3.upload_file(local_case, settings.S3_BUCKET, s3_key)
                    mesh.case_file_s3_key = s3_key

                    # Copy the case file to the user-specified location on the
                    # cluster. Use shlex.quote for the destination so a path
                    # like /home/foo/my mesh/ can't break out into a second
                    # command — the schema layer already restricted the
                    # character set, but defence-in-depth.
                    if output_path:
                        import shlex
                        dest_dir = shlex.quote(output_path.rstrip("/") + "/")
                        dest_file = shlex.quote(
                            output_path.rstrip("/") + f"/{mesh.name}.cas.h5"
                        )
                        src = shlex.quote(remote_case)
                        cmd = f"mkdir -p {dest_dir} && cp {src} {dest_file}"
                        _, err, code = ssh.execute_command(cmd)
                        if code != 0:
                            logger.warning(
                                "Mesh copy to %s failed (rc=%s): %s",
                                output_path, code, err,
                            )

                    # Pull fluent.log for cell count parsing.
                    local_log = os.path.join(tmpdir, "fluent.log")
                    try:
                        sftp.download_file(
                            f"{mesh.cluster_workspace}/fluent.log", local_log
                        )
                        with open(local_log, "r", errors="replace") as f:
                            log_text = f.read()
                        cc = _parse_cell_count(log_text)
                        if cc is not None:
                            mesh.cell_count = cc
                    except Exception:
                        logger.warning(
                            "Could not read fluent.log for mesh %s", mesh.id
                        )
                finally:
                    import shutil
                    shutil.rmtree(tmpdir, ignore_errors=True)
                    sftp.close()
                    ssh.close()

            if mesh.started_at and mesh.completed_at:
                mesh.meshing_minutes = round(
                    (mesh.completed_at - mesh.started_at).total_seconds() / 60.0, 2
                )

            db.commit()
            _publish_mesh_event(mesh_id, "artifact_ready", {
                "case_file_s3_key": mesh.case_file_s3_key,
                "cell_count": mesh.cell_count,
                "meshing_minutes": mesh.meshing_minutes,
            })
            return {
                "mesh_id": mesh_id,
                "case_file_s3_key": mesh.case_file_s3_key,
                "cell_count": mesh.cell_count,
            }

        except Exception as exc:
            logger.exception("Failed to download mesh artifact for %s", mesh_id)
            return {"mesh_id": mesh_id, "error": str(exc)}
