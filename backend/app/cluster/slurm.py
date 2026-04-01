"""SLURM job management via SSH commands."""

from __future__ import annotations

import logging
import re

from app.cluster.ssh_manager import SSHManager

logger = logging.getLogger(__name__)


class SlurmManager:
    """Wraps SLURM CLI commands executed over SSH."""

    def __init__(self, ssh: SSHManager) -> None:
        self.ssh = ssh

    def submit_job(self, script_path: str) -> str:
        """Submit a batch job and return the SLURM job ID.

        Args:
            script_path: Absolute path to the .sh script on the cluster.

        Returns:
            The SLURM job ID as a string.
        """
        out, err, code = self.ssh.execute_command(f"sbatch {script_path}")
        if code != 0:
            raise RuntimeError(f"sbatch failed (exit {code}): {err}")

        # sbatch output: "Submitted batch job 12345"
        match = re.search(r"(\d+)", out)
        if not match:
            raise RuntimeError(f"Could not parse job ID from sbatch output: {out}")

        job_id = match.group(1)
        logger.info("Submitted SLURM job %s", job_id)
        return job_id

    def get_job_status(self, job_id: str) -> dict:
        """Query the status of a SLURM job.

        Returns dict with keys: state, start_time, end_time, elapsed, exit_code.
        """
        out, err, code = self.ssh.execute_command(
            f"sacct -j {job_id} --format=JobID,State,Start,End,Elapsed,ExitCode "
            f"--noheader --parsable2 | head -1"
        )
        if code != 0 or not out:
            # Fallback to squeue for pending/running jobs
            out2, _, _ = self.ssh.execute_command(
                f"squeue -j {job_id} --format='%T' --noheader"
            )
            return {"state": out2.strip() if out2.strip() else "UNKNOWN"}

        parts = out.split("|")
        return {
            "state": parts[1] if len(parts) > 1 else "UNKNOWN",
            "start_time": parts[2] if len(parts) > 2 else None,
            "end_time": parts[3] if len(parts) > 3 else None,
            "elapsed": parts[4] if len(parts) > 4 else None,
            "exit_code": parts[5] if len(parts) > 5 else None,
        }

    def cancel_job(self, job_id: str) -> None:
        """Cancel a running or pending job."""
        out, err, code = self.ssh.execute_command(f"scancel {job_id}")
        if code != 0:
            raise RuntimeError(f"scancel failed (exit {code}): {err}")
        logger.info("Cancelled SLURM job %s", job_id)

    def get_queue(self) -> list[dict]:
        """Get all jobs currently in the SLURM queue.

        Returns list of dicts with: job_id, name, user, state, time, nodes.
        """
        out, err, code = self.ssh.execute_command(
            "squeue --format='%i|%j|%u|%T|%M|%D' --noheader"
        )
        if code != 0:
            logger.error("squeue failed: %s", err)
            return []

        jobs = []
        for line in out.strip().splitlines():
            parts = line.split("|")
            if len(parts) >= 6:
                jobs.append({
                    "job_id": parts[0],
                    "name": parts[1],
                    "user": parts[2],
                    "state": parts[3],
                    "time": parts[4],
                    "nodes": parts[5],
                })
        return jobs

    def get_cluster_info(self) -> dict:
        """Get cluster node summary from sinfo."""
        out, err, code = self.ssh.execute_command(
            "sinfo --format='%T %D' --noheader"
        )
        if code != 0:
            return {"total": 0, "idle": 0, "allocated": 0, "down": 0}

        info = {"total": 0, "idle": 0, "allocated": 0, "down": 0}
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) == 2:
                state, count = parts[0].lower(), int(parts[1])
                info["total"] += count
                if "idle" in state:
                    info["idle"] += count
                elif "alloc" in state or "mix" in state:
                    info["allocated"] += count
                elif "down" in state or "drain" in state:
                    info["down"] += count
        return info
