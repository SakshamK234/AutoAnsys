"""SSH connection manager for HPC cluster communication."""

from __future__ import annotations

import logging
from pathlib import Path

import paramiko

from app.config import settings

logger = logging.getLogger(__name__)


class SSHManager:
    """Manages SSH connections to the HPC cluster login node."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        key_path: str | None = None,
    ) -> None:
        self.host = host or settings.CLUSTER_HOST
        self.port = port or settings.CLUSTER_PORT
        self.username = username or settings.CLUSTER_USER
        self.key_path = key_path or settings.CLUSTER_KEY_PATH
        self._client: paramiko.SSHClient | None = None

    def connect(self) -> None:
        """Establish SSH connection using key-based authentication."""
        if self._client is not None:
            return

        self._client = paramiko.SSHClient()
        self._client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        key_file = Path(self.key_path).expanduser()
        logger.info("Connecting to %s:%d as %s", self.host, self.port, self.username)

        self._client.connect(
            hostname=self.host,
            port=self.port,
            username=self.username,
            key_filename=str(key_file),
            timeout=30,
        )
        logger.info("SSH connection established.")

    def execute_command(self, command: str) -> tuple[str, str, int]:
        """Execute a command on the remote host.

        Returns:
            Tuple of (stdout, stderr, exit_code).
        """
        if self._client is None:
            raise RuntimeError("SSH not connected. Call connect() first.")

        logger.debug("Executing: %s", command)
        stdin, stdout, stderr = self._client.exec_command(command, timeout=120)
        exit_code = stdout.channel.recv_exit_status()

        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()

        if exit_code != 0:
            logger.warning("Command failed (exit %d): %s\nstderr: %s", exit_code, command, err)

        return out, err, exit_code

    def open_sftp(self) -> paramiko.SFTPClient:
        """Open an SFTP session on the current SSH connection."""
        if self._client is None:
            raise RuntimeError("SSH not connected. Call connect() first.")
        return self._client.open_sftp()

    def close(self) -> None:
        """Close the SSH connection."""
        if self._client is not None:
            self._client.close()
            self._client = None
            logger.info("SSH connection closed.")

    def __enter__(self) -> SSHManager:
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
