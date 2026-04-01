"""SFTP file transfer utilities for cluster communication."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import paramiko

logger = logging.getLogger(__name__)


class SFTPManager:
    """Handles file uploads and downloads to/from the HPC cluster."""

    def __init__(self, sftp: paramiko.SFTPClient) -> None:
        self.sftp = sftp

    def upload_file(self, local_path: str, remote_path: str) -> None:
        """Upload a single file to the cluster."""
        remote_dir = os.path.dirname(remote_path)
        self._mkdir_p(remote_dir)
        logger.info("Uploading %s → %s", local_path, remote_path)
        self.sftp.put(local_path, remote_path)

    def upload_string(self, content: str, remote_path: str) -> None:
        """Write a string directly to a remote file."""
        remote_dir = os.path.dirname(remote_path)
        self._mkdir_p(remote_dir)
        logger.info("Writing content to %s (%d bytes)", remote_path, len(content))
        with self.sftp.open(remote_path, "w") as f:
            f.write(content)

    def download_file(self, remote_path: str, local_path: str) -> None:
        """Download a file from the cluster."""
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading %s → %s", remote_path, local_path)
        self.sftp.get(remote_path, local_path)

    def read_file(self, remote_path: str) -> str:
        """Read a remote file and return its contents as a string."""
        with self.sftp.open(remote_path, "r") as f:
            return f.read().decode() if isinstance(f.read(), bytes) else f.read()

    def list_dir(self, remote_path: str) -> list[dict]:
        """List files in a remote directory with metadata."""
        entries = []
        for attr in self.sftp.listdir_attr(remote_path):
            entries.append({
                "name": attr.filename,
                "size": attr.st_size,
                "modified": attr.st_mtime,
                "is_dir": attr.st_mode is not None and (attr.st_mode & 0o40000) != 0,
            })
        return entries

    def _mkdir_p(self, remote_dir: str) -> None:
        """Recursively create remote directories (like mkdir -p)."""
        dirs_to_create = []
        current = remote_dir
        while current and current != "/":
            try:
                self.sftp.stat(current)
                break
            except FileNotFoundError:
                dirs_to_create.append(current)
                current = os.path.dirname(current)

        for d in reversed(dirs_to_create):
            try:
                self.sftp.mkdir(d)
            except IOError:
                pass

    def close(self) -> None:
        """Close the SFTP session."""
        self.sftp.close()
