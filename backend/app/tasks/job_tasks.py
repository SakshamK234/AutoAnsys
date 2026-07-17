"""Celery tasks for job lifecycle management."""

from __future__ import annotations

import csv
import io
import json
import logging
import math
import os
import random
import tempfile
import uuid
from datetime import datetime, timezone

import socket

import boto3
import paramiko
import redis as sync_redis

from app.config import settings
from app.database import SyncSessionLocal
from app.models.job import Job, JobStatus
from app.models.result_file import ResultFile
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

# Transient cluster-side errors (network blips, SSH timeouts) that should
# trigger a Celery retry rather than permanently failing the job.
_TRANSIENT_CLUSTER_ERRORS = (
    socket.timeout,
    TimeoutError,
    ConnectionError,
    paramiko.SSHException,
)


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

# A queued job with no SLURM id after this many seconds has a lost submission
# task (dropped from the broker, e.g. enqueued while the worker was down); the
# poller re-drives it. Comfortably longer than a real submit (SFTP + sbatch).
_RESUBMIT_STALE_SECONDS = 150


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


def _publish_job_event(job_id: str, event_type: str, data: dict) -> None:
    """Publish a real-time event to the job's Redis pub/sub channel."""
    try:
        r = sync_redis.from_url(settings.REDIS_URL)
        r.publish(
            f"job:{job_id}:events",
            json.dumps({"type": event_type, "data": data}),
        )
        r.close()
    except Exception:
        logger.debug("Failed to publish event for job %s", job_id)


@celery_app.task(name="app.tasks.job_tasks.submit_job_to_cluster", bind=True, max_retries=2)
def submit_job_to_cluster(self, job_id: str) -> dict:
    """Submit a queued job to the HPC cluster (background Celery task).

    Two code paths:
      • Job.mesh_id is NULL  → legacy combined journal (mesh + solve in one run).
      • Job.mesh_id is SET   → solver-from-case journal; the mesh.cas.h5 is
                               copied from the referenced Mesh.cluster_workspace
                               into this job's workspace via `cp` on the cluster.
    """
    logger.info("Submitting job %s to cluster (Celery task)", job_id)

    with SyncSessionLocal() as db:
        from app.models.geometry import Geometry
        from app.models.mesh import Mesh, MeshStatus

        job = db.query(Job).filter(Job.id == uuid.UUID(job_id)).first()
        if not job:
            return {"job_id": job_id, "error": "Job not found"}

        if job.status == JobStatus.draft:
            # Enqueue-before-commit race; retry once the API commit is visible.
            logger.warning("Job %s still in draft — retrying in 2s (commit-race)", job_id)
            raise self.retry(countdown=2, max_retries=3)

        if job.status != JobStatus.queued:
            return {"job_id": job_id, "error": f"Job is in '{job.status.value}' state, expected queued"}

        # Idempotency guard: if a SLURM id is already set, this job was already
        # submitted (e.g. the poller re-drove a submit that had actually run) —
        # do not sbatch a second time.
        if job.slurm_job_id:
            return {"job_id": job_id, "slurm_job_id": job.slurm_job_id, "note": "already submitted"}

        geometry = db.query(Geometry).filter(Geometry.id == job.geometry_id).first()
        if not geometry:
            job.status = JobStatus.failed
            db.commit()
            _publish_job_event(job_id, "status_update", {"status": "failed"})
            return {"job_id": job_id, "error": "Geometry not found"}

        mesh = None
        if job.mesh_id:
            mesh = db.query(Mesh).filter(Mesh.id == job.mesh_id).first()
            if not mesh:
                job.status = JobStatus.failed
                db.commit()
                _publish_job_event(job_id, "status_update", {"status": "failed"})
                return {"job_id": job_id, "error": "Referenced mesh not found"}
            if mesh.status != MeshStatus.completed or not mesh.cluster_workspace:
                job.status = JobStatus.failed
                db.commit()
                _publish_job_event(job_id, "status_update", {"status": "failed"})
                return {
                    "job_id": job_id,
                    "error": f"Referenced mesh is in '{mesh.status.value}' state; must be completed",
                }

        workspace = f"{settings.CLUSTER_WORKSPACE_BASE}/{job.id}"
        job.cluster_workspace = workspace

        from app.utils.sanitize import sanitize_path
        geom_filename = sanitize_path(geometry.original_name) or "geometry.stp"

        ssh = None
        tmpdir = None
        try:
            from app.journal.generator import JournalGenerator
            gen = JournalGenerator()

            ssh, slurm_mgr = _get_cluster_managers()
            from app.cluster.sftp import SFTPManager
            sftp_client = ssh.open_sftp()
            sftp = SFTPManager(sftp_client)

            # Reproducibility record (AUDIT E5): what produced this run.
            from app.run_metadata import build_run_metadata, to_json
            run_meta = build_run_metadata(
                kind="job",
                entity_id=str(job.id),
                cfd_mode=job.config.get("cfd_mode", "individual_part"),
                config=job.config,
                fluent_module=settings.FLUENT_MODULE,
                git_sha=settings.GIT_SHA,
            )
            sftp.upload_string(to_json(run_meta), f"{workspace}/run_metadata.json")

            if mesh is not None:
                # SPLIT PATH — solver reads an existing mesh.cas.h5
                solver_jou = gen.generate_solver_journal(
                    solver_config=job.config["solver"],
                    case_file=f"{workspace}/mesh.cas.h5",
                    workspace=workspace,
                    cfd_mode=job.config.get("cfd_mode", "individual_part"),
                )
                slurm_sh = gen.generate_slurm_script(
                    job.config["slurm"],
                    workspace=workspace,
                    fluent_module=settings.FLUENT_MODULE,
                    # Solver-from-case journal expects /define/... TUI paths,
                    # which only exist when Fluent starts in solution mode.
                    start_mode="solver",
                )

                sftp.upload_string(solver_jou, f"{workspace}/autoansys.jou")
                sftp.upload_string(slurm_sh, f"{workspace}/run.sh")
                sftp.close()

                # Copy the mesh case file from the referenced Mesh's workspace
                # into this job's workspace. `cp` on the cluster avoids shipping
                # a multi-GB .cas.h5 back through our API host.
                if not settings.CLUSTER_MOCK_MODE:
                    src = f"{mesh.cluster_workspace}/mesh.cas.h5"
                    dst = f"{workspace}/mesh.cas.h5"
                    ssh.execute_command(f"mkdir -p {workspace}")
                    out, err, code = ssh.execute_command(f"cp -f {src} {dst}")
                    if code != 0:
                        raise RuntimeError(
                            f"Failed to copy mesh case file on cluster (exit {code}): {err}"
                        )
            else:
                # LEGACY PATH — combined meshing + solver in a single journal
                tmpdir = tempfile.mkdtemp(prefix="autoansys_")
                local_geom_path = os.path.join(tmpdir, geom_filename)
                s3 = _get_s3_client()
                s3.download_file(settings.S3_BUCKET, geometry.s3_key, local_geom_path)

                combined_jou = gen.generate_combined_journal(
                    mesh_config=job.config["mesh"],
                    solver_config=job.config["solver"],
                    geometry_file=f"{workspace}/{geom_filename}",
                    workspace=workspace,
                    cfd_mode=job.config.get("cfd_mode", "individual_part"),
                )
                slurm_sh = gen.generate_slurm_script(
                    job.config["slurm"],
                    workspace=workspace,
                    fluent_module=settings.FLUENT_MODULE,
                )

                sftp.upload_file(local_geom_path, f"{workspace}/{geom_filename}")
                sftp.upload_string(combined_jou, f"{workspace}/autoansys.jou")
                sftp.upload_string(slurm_sh, f"{workspace}/run.sh")
                sftp.close()

            slurm_job_id = slurm_mgr.submit_job(f"{workspace}/run.sh")
            job.slurm_job_id = slurm_job_id
            db.commit()

            _publish_job_event(job_id, "status_update", {
                "status": "queued",
                "slurm_job_id": slurm_job_id,
            })

            logger.info("Job %s submitted with SLURM ID %s", job.id, slurm_job_id)
            return {"job_id": job_id, "slurm_job_id": slurm_job_id, "status": "queued"}

        except _TRANSIENT_CLUSTER_ERRORS as exc:
            # Transient ARC outage — don't burn the job. Release SSH/tmp in
            # the finally block, then ask Celery to requeue.
            logger.warning(
                "Transient cluster error submitting job %s: %s — retrying",
                job_id, exc,
            )
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()
                ssh = None
            if tmpdir:
                import shutil
                shutil.rmtree(tmpdir, ignore_errors=True)
                tmpdir = None
            raise self.retry(exc=exc, countdown=60)
        except Exception as exc:
            logger.exception("Failed to submit job %s", job_id)
            job.status = JobStatus.failed
            job.completed_at = _utcnow_naive()
            db.commit()
            _publish_job_event(job_id, "status_update", {"status": "failed"})
            return {"job_id": job_id, "error": str(exc)}
        finally:
            if ssh and not settings.CLUSTER_MOCK_MODE:
                ssh.close()
            if tmpdir:
                import shutil
                shutil.rmtree(tmpdir, ignore_errors=True)


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
                    # No SLURM id: the submission task never set one. If the job
                    # has been queued longer than the submit should ever take,
                    # its submit task was lost (e.g. enqueued while the worker
                    # was down, then dropped) — re-drive it. submit_job_to_cluster
                    # re-checks status and no-ops if a SLURM id already exists,
                    # so re-enqueue is safe against a merely-slow submit.
                    if job.submitted_at is not None:
                        age = (_utcnow_naive() - job.submitted_at).total_seconds()
                        if age > _RESUBMIT_STALE_SECONDS:
                            logger.warning(
                                "Job %s queued %.0fs with no SLURM id — re-driving "
                                "lost submission", job.id, age,
                            )
                            submit_job_to_cluster.delay(str(job.id))
                    continue

                try:
                    status_info = slurm_mgr.get_job_status(job.slurm_job_id)
                    raw_state = status_info.get("state", "UNKNOWN").strip()
                    # sacct emits "CANCELLED by <uid>" — keep only the verb.
                    slurm_state = raw_state.split()[0] if raw_state else raw_state
                    new_status = _SLURM_STATE_MAP.get(slurm_state)

                    if new_status is None:
                        logger.warning(
                            "Unknown SLURM state '%s' for job %s", slurm_state, job.id
                        )
                        continue

                    if new_status != job.status:
                        job.status = new_status
                        event_data: dict = {"status": new_status.value}
                        if new_status == JobStatus.running and job.started_at is None:
                            job.started_at = _utcnow_naive()
                            event_data["started_at"] = job.started_at.isoformat()
                        if new_status in (JobStatus.completed, JobStatus.failed, JobStatus.cancelled):
                            job.completed_at = _utcnow_naive()
                            event_data["completed_at"] = job.completed_at.isoformat()
                            if new_status == JobStatus.completed:
                                download_results.delay(str(job.id))
                        _publish_job_event(str(job.id), "status_update", event_data)
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
        _publish_job_event(job_id, "results_ready", {"files_downloaded": files_downloaded})
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

    # Generate mock contour images
    for contour_name, label in [
        ("contour_velocity.png", "Velocity Magnitude"),
        ("contour_velocity_midplane.png", "Velocity (Mid-plane)"),
        ("contour_pressure.png", "Static Pressure"),
        ("contour_pressure_midplane.png", "Pressure (Mid-plane)"),
        ("contour_total_pressure.png", "Total Pressure"),
        ("contour_cp.png", "Pressure Coefficient"),
        ("contour_wall_shear.png", "Wall Shear Stress"),
        ("contour_tke_midplane.png", "TKE (Mid-plane)"),
    ]:
        img_bytes = _generate_mock_contour_image(label)
        img_key = f"results/{job.id}/{contour_name}"
        s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=img_key,
            Body=img_bytes,
            ContentType="image/png",
        )
        db.add(ResultFile(
            job_id=job.id,
            filename=contour_name,
            file_type="contour_image",
            s3_key=img_key,
            file_size=len(img_bytes),
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
        "run_metadata.json": "run_metadata",
        "result.cas.h5": "case_data",
        "result.msh.h5": "mesh_data",
        "contour_velocity.png": "contour_image",
        "contour_velocity_midplane.png": "contour_image",
        "contour_pressure.png": "contour_image",
        "contour_pressure_midplane.png": "contour_image",
        "contour_total_pressure.png": "contour_image",
        "contour_cp.png": "contour_image",
        "contour_wall_shear.png": "contour_image",
        "contour_tke_midplane.png": "contour_image",
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
    """Generate synthetic body FORCE data (N) that looks like convergence.

    Matches the M2 journal output format: columns drag_force / lift_force / mom_y
    are half-model forces in Newtons. The post-processor (app.post.forces) then
    applies the symmetry factor and derives Cd/Cl/Cm, so mock results exercise the
    same path as a real run.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["iteration", "drag_force", "lift_force", "mom_y"])

    # Half-model magnitudes (N / N·m) for an FSAE car at ~15.65 m/s.
    drag_final = 80.0 + random.uniform(-5.0, 5.0)
    lift_final = -270.0 + random.uniform(-15.0, 15.0)   # negative = downforce
    mom_final = -15.0 + random.uniform(-3.0, 3.0)

    for i in range(1, iterations + 1):
        progress = 1 - math.exp(-i / 300)
        noise = math.exp(-i / 500) * random.uniform(-0.1, 0.1)
        drag = drag_final * progress + noise * 30
        lift = lift_final * progress + noise * 100
        mom = mom_final * progress + noise * 8
        writer.writerow([i, f"{drag:.4f}", f"{lift:.4f}", f"{mom:.4f}"])

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


def _generate_mock_contour_image(label: str) -> bytes:
    """Generate a simple placeholder PNG contour image for mock mode.

    Creates a minimal valid PNG with a colored gradient.
    Uses only the standard library (no PIL/matplotlib dependency).
    """
    import struct
    import zlib

    width, height = 640, 400

    # Color maps for different contour types
    color_maps = {
        "Velocity Magnitude": ((0, 0, 180), (0, 200, 0), (220, 0, 0)),
        "Static Pressure": ((0, 0, 220), (0, 180, 180), (220, 220, 0)),
        "Total Pressure": ((20, 0, 120), (0, 160, 160), (240, 200, 0)),
        "Wall Shear Stress": ((0, 60, 0), (0, 200, 0), (255, 255, 0)),
    }
    c_low, c_mid, c_high = color_maps.get(
        label, ((0, 0, 200), (0, 200, 0), (200, 0, 0))
    )

    def lerp_color(t: float) -> tuple:
        if t < 0.5:
            s = t * 2
            return (
                int(c_low[0] + (c_mid[0] - c_low[0]) * s),
                int(c_low[1] + (c_mid[1] - c_low[1]) * s),
                int(c_low[2] + (c_mid[2] - c_low[2]) * s),
            )
        else:
            s = (t - 0.5) * 2
            return (
                int(c_mid[0] + (c_high[0] - c_mid[0]) * s),
                int(c_mid[1] + (c_high[1] - c_mid[1]) * s),
                int(c_mid[2] + (c_high[2] - c_mid[2]) * s),
            )

    # Build raw pixel rows (filter byte 0 + RGB for each pixel)
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # PNG filter: None
        for x in range(width):
            t = x / width
            noise = math.sin(x * 0.05) * math.cos(y * 0.08) * 0.15
            t = max(0.0, min(1.0, t + noise))
            r, g, b = lerp_color(t)
            raw.extend((r, g, b))

    # Encode PNG
    def _make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        return (
            struct.pack(">I", len(data))
            + chunk
            + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)
        )

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    compressed = zlib.compress(bytes(raw), 6)

    png = b"\x89PNG\r\n\x1a\n"
    png += _make_chunk(b"IHDR", ihdr_data)
    png += _make_chunk(b"IDAT", compressed)
    png += _make_chunk(b"IEND", b"")
    return png
