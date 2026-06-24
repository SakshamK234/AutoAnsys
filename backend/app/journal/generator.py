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
        cfd_mode: str = "individual_part",
    ) -> str:
        """Generate a single Fluent journal: meshing → switch-to-solution → solver.

        Runs entirely within one `fluent 3ddp -meshing` session.
        The mesh stays in memory — no file write/read needed between phases.

        Args:
            mesh_config: Mesh configuration dictionary.
            solver_config: Solver configuration dictionary.
            geometry_file: Absolute path to geometry file on cluster.
            workspace: Job workspace directory on cluster.
            cfd_mode: "individual_part" or "full_car" — toggles wheel BCs and
                full-car-specific workflow steps per the team SOPs.
        """
        template = self.env.get_template("mesh_watertight.jou.j2")
        return template.render(
            mesh=mesh_config,
            solver=solver_config,
            geometry_file=geometry_file,
            workspace=workspace,
            cfd_mode=cfd_mode,
        )

    # Mesh workflow → template. "watertight" (clean components) vs
    # "fault-tolerant" (surface-wrapped, dirty full-car assemblies) — AUDIT C11.
    _MESH_TEMPLATES = {
        "watertight": "mesh_only.jou.j2",
        "fault-tolerant": "mesh_fault_tolerant.jou.j2",
    }

    def generate_mesh_journal(
        self,
        mesh_config: dict,
        geometry_file: str,
        workspace: str,
        cfd_mode: str = "individual_part",
    ) -> str:
        """Generate a MESH-ONLY journal for the configured mesh workflow.

        Runs Fluent meshing (Watertight or Fault-tolerant per
        ``mesh_config['workflow']``), writes mesh.cas.h5 into `workspace`, and
        exits. The case file is the first-class artifact downstream solver jobs
        consume via generate_solver_journal().
        """
        workflow = (mesh_config or {}).get("workflow", "watertight")
        template_name = self._MESH_TEMPLATES.get(workflow)
        if template_name is None:
            raise ValueError(
                f"Unknown mesh workflow {workflow!r}; "
                f"expected one of {sorted(self._MESH_TEMPLATES)}"
            )
        template = self.env.get_template(template_name)
        return template.render(
            mesh=mesh_config,
            geometry_file=geometry_file,
            workspace=workspace,
            cfd_mode=cfd_mode,
        )

    def generate_solver_journal(
        self,
        solver_config: dict,
        case_file: str,
        workspace: str,
        cfd_mode: str = "individual_part",
    ) -> str:
        """Generate a SOLVER-FROM-CASE journal.

        Reads an existing mesh.cas.h5 (produced by a prior mesh-only job),
        applies BCs / models / reference values, iterates, and writes
        results + contour images to `workspace`.
        """
        template = self.env.get_template("solver_from_case.jou.j2")
        return template.render(
            solver=solver_config,
            case_file=case_file,
            workspace=workspace,
            cfd_mode=cfd_mode,
        )

    def generate_slurm_script(
        self,
        slurm_config: dict,
        workspace: str,
        fluent_module: str = "ANSYS/2025R1",
        start_mode: str = "meshing",
    ) -> str:
        """Generate a SLURM batch script.

        Args:
            slurm_config: SLURM resource configuration.
            workspace: Job workspace directory on cluster.
            fluent_module: Module to load for ANSYS.
            start_mode: "meshing" launches Fluent with `-meshing` (required for
                mesh-only and combined journals that begin in the meshing
                workflow). "solver" launches without `-meshing` so the journal
                starts directly in solution mode — required for solver-from-
                case journals, which use /define/... TUI paths that don't
                exist in meshing mode and crash with `Error: invalid command`.
        """
        if start_mode not in ("meshing", "solver"):
            raise ValueError(f"start_mode must be 'meshing' or 'solver', got {start_mode!r}")
        template = self.env.get_template("slurm_job.sh.j2")
        return template.render(
            slurm=slurm_config,
            workspace=workspace,
            fluent_module=fluent_module,
            start_mode=start_mode,
        )
