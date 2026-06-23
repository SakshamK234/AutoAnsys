"""Dry-run / ``--validate`` artifact renderer.

Renders **every** generated artifact (Fluent journals + SLURM batch script) for
**both** run profiles, without launching Fluent or contacting SLURM. This is the
offline pre-flight: it lets a maintainer (or a test) inspect exactly what would be
sent to the cluster for a component vs a full-car job.

Runnable with **jinja2 only** — no pydantic, DB, S3, or SSH — so it works in any
environment, including CI without the full app stack::

    python -m app.journal.validate --out ./_dryrun
    python -m app.journal.validate            # writes to a temp dir, prints paths

By default it uses the representative example configs in
``app.journal.example_configs``. Those mirror ``Job.config`` for each profile.

Exit code is non-zero if any artifact fails to render, so this doubles as a smoke
check in CI.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from app.journal.example_configs import PROFILES, example_config
from app.journal.generator import JournalGenerator

# Placeholder paths used purely so the templates have something to render; they
# are never created or executed here.
_GEOM = "{workspace}/geometry.x_t"
_WORKSPACE = "/scratch/<user>/autoansys/jobs/<job_id>"
_CASE = "/scratch/<user>/autoansys/jobs/<job_id>/mesh.cas.h5"


def render_profile_artifacts(cfd_mode: str) -> dict[str, str]:
    """Render all artifacts for one run profile. Returns {filename: content}.

    Covers both journal paths (legacy combined + split mesh/solver) and both
    SLURM launch modes, so nothing that could ship to the cluster is unrendered.
    """
    cfg = example_config(cfd_mode)
    gen = JournalGenerator()
    workspace = _WORKSPACE.replace("<job_id>", f"<{cfd_mode}_job>")
    geom = _GEOM.format(workspace=workspace)

    return {
        # Legacy combined path (Job.mesh_id is NULL)
        "combined.jou": gen.generate_combined_journal(
            mesh_config=cfg["mesh"], solver_config=cfg["solver"],
            geometry_file=geom, workspace=workspace, cfd_mode=cfd_mode,
        ),
        # Split path — Phase 1 (mesh only) and Phase 2 (solve from case)
        "mesh_only.jou": gen.generate_mesh_journal(
            mesh_config=cfg["mesh"], geometry_file=geom,
            workspace=workspace, cfd_mode=cfd_mode,
        ),
        "solver_from_case.jou": gen.generate_solver_journal(
            solver_config=cfg["solver"], case_file=_CASE,
            workspace=workspace, cfd_mode=cfd_mode,
        ),
        # SLURM scripts for both launch modes
        "run_meshing.sh": gen.generate_slurm_script(
            cfg["slurm"], workspace=workspace, start_mode="meshing",
        ),
        "run_solver.sh": gen.generate_slurm_script(
            cfg["slurm"], workspace=workspace, start_mode="solver",
        ),
    }


def render_all(out_dir: Path) -> list[Path]:
    """Render artifacts for every profile into ``out_dir/<profile>/``."""
    written: list[Path] = []
    for profile in PROFILES:
        pdir = out_dir / profile
        pdir.mkdir(parents=True, exist_ok=True)
        for filename, content in render_profile_artifacts(profile).items():
            path = pdir / filename
            # newline="\n" — generated cluster artifacts must be LF even on Windows
            # (a CRLF run.sh fails on Linux with "bad interpreter"); see AUDIT.md E3.
            path.write_text(content, encoding="utf-8", newline="\n")
            written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out", type=Path, default=None,
        help="Output directory (default: a fresh temp dir).",
    )
    args = parser.parse_args(argv)

    out_dir = args.out or Path(tempfile.mkdtemp(prefix="autoansys_dryrun_"))
    try:
        written = render_all(out_dir)
    except Exception as exc:  # noqa: BLE001 — surface any render failure as exit 1
        print(f"DRY-RUN FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"Rendered {len(written)} artifacts for profiles {list(PROFILES)} into:")
    print(f"  {out_dir}")
    for path in written:
        print(f"  - {path.relative_to(out_dir)}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
