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

    def generate_mesh_journal(self, mesh_config: dict, geometry_file: str, output_mesh: str) -> str:
        """Generate a Fluent Mesher Watertight Geometry journal file.

        Args:
            mesh_config: Mesh configuration dictionary.
            geometry_file: Absolute path to geometry file on cluster.
            output_mesh: Absolute path for output .msh.h5 file.
        """
        template = self.env.get_template("mesh_watertight.jou.j2")
        return template.render(
            mesh=mesh_config,
            geometry_file=geometry_file,
            output_mesh=output_mesh,
        )

    def generate_solver_journal(self, solver_config: dict, mesh_file: str, workspace: str) -> str:
        """Generate Fluent solver setup + run journal.

        Args:
            solver_config: Solver configuration dictionary.
            mesh_file: Absolute path to the .msh.h5 file from meshing.
            workspace: Job workspace directory on cluster.
        """
        template = self.env.get_template("solver_setup.jou.j2")
        setup = template.render(solver=solver_config, mesh_file=mesh_file, workspace=workspace)

        template_run = self.env.get_template("solver_run.jou.j2")
        run = template_run.render(solver=solver_config, workspace=workspace)

        return setup + "\n" + run

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
