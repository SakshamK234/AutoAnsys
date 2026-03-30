"""Mock cluster managers for development without HPC access."""

from __future__ import annotations

import io
import logging
import uuid

logger = logging.getLogger(__name__)


class MockSFTPClient:
    """In-memory SFTP stub that accepts writes and silently discards them."""

    def put(self, local_path: str, remote_path: str) -> None:
        logger.info("[MOCK SFTP] put %s -> %s", local_path, remote_path)

    def open(self, remote_path: str, mode: str = "r"):
        logger.info("[MOCK SFTP] open %s mode=%s", remote_path, mode)
        return io.StringIO("")

    def get(self, remote_path: str, local_path: str) -> None:
        logger.info("[MOCK SFTP] get %s -> %s", remote_path, local_path)

    def stat(self, path: str):
        raise FileNotFoundError(path)

    def mkdir(self, path: str) -> None:
        logger.info("[MOCK SFTP] mkdir %s", path)

    def listdir_attr(self, path: str) -> list:
        return []

    def close(self) -> None:
        pass


class MockSSHManager:
    """Drop-in replacement for SSHManager that never opens a real connection."""

    def connect(self) -> None:
        logger.info("[MOCK SSH] Connect (no-op)")

    def execute_command(self, command: str) -> tuple[str, str, int]:
        logger.info("[MOCK SSH] exec: %s", command)

        if command.startswith("sbatch"):
            mock_id = f"mock-{uuid.uuid4().hex[:8]}"
            return f"Submitted batch job {mock_id}", "", 0

        if "sacct" in command or "squeue" in command:
            return "COMPLETED", "", 0

        if command.startswith("scancel"):
            return "", "", 0

        if command.startswith("mkdir"):
            return "", "", 0

        if command.startswith("sinfo"):
            return "idle 4\nallocated 2", "", 0

        return "", "", 0

    def open_sftp(self) -> MockSFTPClient:
        return MockSFTPClient()

    def close(self) -> None:
        logger.info("[MOCK SSH] Close (no-op)")

    def __enter__(self) -> MockSSHManager:
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()


class MockSlurmManager:
    """Drop-in replacement for SlurmManager that returns mock data."""

    def __init__(self, ssh: MockSSHManager) -> None:
        self.ssh = ssh

    def submit_job(self, script_path: str) -> str:
        mock_id = f"mock-{uuid.uuid4().hex[:8]}"
        logger.info("[MOCK SLURM] Submitted job %s for script %s", mock_id, script_path)
        return mock_id

    def get_job_status(self, job_id: str) -> dict:
        return {
            "state": "COMPLETED",
            "start_time": None,
            "end_time": None,
            "elapsed": "00:00:01",
            "exit_code": "0:0",
        }

    def cancel_job(self, job_id: str) -> None:
        logger.info("[MOCK SLURM] Cancelled job %s", job_id)

    def get_queue(self) -> list[dict]:
        return []

    def get_cluster_info(self) -> dict:
        return {"total": 8, "idle": 4, "allocated": 2, "down": 0}
