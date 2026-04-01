"""Jinja2-based generator for Fluent journal files and SLURM scripts."""

from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).parent / "templates"


class JournalGenerator:
    """Generates Fluent journal files and SLURM batch scripts from configuration."""

    def __init__(self) -> None:
        self.env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True,
        )

    def generate_combined_journal(
        self,
        mesh_config: dict,
        solver_config: dict,
        geometry_file: str,
        workspace: str,
    ) -> str:
        """Generate a single Fluent journal: meshing → switch-to-solution → solver.

        Runs entirely within one `fluent 3ddp -meshing` session.
        The mesh stays in memory — no file write/read needed between phases.

        Args:
            mesh_config: Mesh configuration dictionary.
            solver_config: Solver configuration dictionary.
            geometry_file: Absolute path to geometry file on cluster.
            workspace: Job workspace directory on cluster.
        """
        template = self.env.get_template("mesh_watertight.jou.j2")
        return template.render(
            mesh=mesh_config,
            solver=solver_config,
            geometry_file=geometry_file,
            workspace=workspace,
        )

    def generate_slurm_script(
        self,
        slurm_config: dict,
        workspace: str,
        fluent_module: str = "ANSYS/2025R1",
    ) -> str:
        """Generate a SLURM batch script.

        Args:
            slurm_config: SLURM resource configuration.
            workspace: Job workspace directory on cluster.
            fluent_module: Module to load for ANSYS.
        """
        template = self.env.get_template("slurm_job.sh.j2")
        return template.render(
            slurm=slurm_config,
            workspace=workspace,
            fluent_module=fluent_module,
        )
