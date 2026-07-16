"""Fluent-free golden / characterization tests for artifact generation.

These render the Fluent journals and SLURM script for **both** run profiles and
compare them byte-for-byte against committed golden files under ``tests/golden/``.
They need **jinja2 only** — no pydantic, DB, S3, or cluster — so they run anywhere.

Purpose: lock the *current* generated output before later milestones change the
templates. When a milestone intentionally changes generation, regenerate the
goldens with ``UPDATE_GOLDEN=1 pytest`` (or ``python -m app.journal.validate
--out tests/golden``) and review the diff — that diff IS the change review.

Alongside golden equality, a set of structural invariants assert properties that
must hold regardless of the golden contents (LF line endings, exit codes, SLURM
env-var use, no unrendered Jinja, correct meshing/solver launch flag).
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.journal.example_configs import PROFILES, example_config
from app.journal.generator import JournalGenerator
from app.journal.validate import render_profile_artifacts

GOLDEN_DIR = Path(__file__).parent / "golden"
_UPDATE = os.environ.get("UPDATE_GOLDEN") == "1"

JOURNAL_FILES = ("combined.jou", "mesh_only.jou", "solver_from_case.jou")
SLURM_FILES = ("run_meshing.sh", "run_solver.sh")
ALL_FILES = JOURNAL_FILES + SLURM_FILES


def _cases():
    return [(p, f) for p in PROFILES for f in ALL_FILES]


# ── Golden-file characterization ──────────────────────────────────────────


@pytest.mark.parametrize("profile,filename", _cases())
def test_artifact_matches_golden(profile: str, filename: str):
    rendered = render_profile_artifacts(profile)[filename]
    golden_path = GOLDEN_DIR / profile / filename

    if _UPDATE:
        golden_path.parent.mkdir(parents=True, exist_ok=True)
        golden_path.write_text(rendered, encoding="utf-8", newline="\n")

    assert golden_path.exists(), (
        f"Missing golden {golden_path}. Generate it with "
        f"`python -m app.journal.validate --out tests/golden` or `UPDATE_GOLDEN=1 pytest`."
    )
    expected = golden_path.read_text(encoding="utf-8")
    # Compare with normalized newlines so a checkout that converted golden files
    # to CRLF doesn't cause a spurious failure; the LF guarantee for *generated*
    # output is asserted separately below.
    assert rendered.replace("\r\n", "\n") == expected.replace("\r\n", "\n"), (
        f"{profile}/{filename} drifted from golden. If intentional, "
        f"regenerate with UPDATE_GOLDEN=1 and review the diff."
    )


# ── Structural invariants (hold regardless of golden contents) ────────────


@pytest.mark.parametrize("profile", PROFILES)
def test_no_unrendered_jinja(profile: str):
    # Only check Jinja statement/comment delimiters. The `{{`/`}}` expression
    # delimiters collide with the Python dict literals inside the `%py-exec`
    # workflow calls (e.g. `...Length': 0}})`), so they can't be used as markers.
    # Unrendered expressions are instead caught by golden equality + the explicit
    # propagation assertions below.
    for filename, content in render_profile_artifacts(profile).items():
        for token in ("{%", "%}", "{#", "#}"):
            assert token not in content, f"Unrendered Jinja {token!r} in {profile}/{filename}"


@pytest.mark.parametrize("profile", PROFILES)
def test_generated_output_is_lf_only(profile: str):
    # AUDIT.md E3: a CRLF run.sh fails on Linux ("bad interpreter"). Generated
    # content must never contain carriage returns.
    for filename, content in render_profile_artifacts(profile).items():
        assert "\r" not in content, f"CR found in generated {profile}/{filename}"


@pytest.mark.parametrize("profile", PROFILES)
def test_journals_exit_cleanly(profile: str):
    arts = render_profile_artifacts(profile)
    for filename in JOURNAL_FILES:
        assert arts[filename].rstrip().endswith("/exit yes"), (
            f"{profile}/{filename} must end with '/exit yes'"
        )


@pytest.mark.parametrize("profile", PROFILES)
def test_slurm_scripts_are_well_formed(profile: str):
    arts = render_profile_artifacts(profile)
    for filename in SLURM_FILES:
        sh = arts[filename]
        assert sh.startswith("#!/bin/bash"), f"{filename} missing shebang"
        # Derives core count from SLURM at runtime, not a hardcoded value.
        assert "SLURM_NTASKS" in sh, f"{filename} must use $SLURM_NTASKS"
        # The correct task-binding (see slurm_job.sh.j2 comment) — must not regress.
        assert "--ntasks-per-node=" in sh and "--cpus-per-task=1" in sh
        # Non-zero Fluent exit must propagate so SLURM marks the job FAILED.
        assert "exit $FLUENT_EXIT" in sh, f"{filename} must propagate Fluent exit code"


def test_slurm_start_mode_controls_meshing_flag():
    gen = JournalGenerator()
    slurm_cfg = example_config("individual_part")["slurm"]
    meshing = gen.generate_slurm_script(slurm_cfg, workspace="/ws", start_mode="meshing")
    solver = gen.generate_slurm_script(slurm_cfg, workspace="/ws", start_mode="solver")
    assert 'FLUENT_MODE_FLAG="-meshing"' in meshing
    assert 'FLUENT_MODE_FLAG=""' in solver


def test_slurm_rejects_invalid_start_mode():
    gen = JournalGenerator()
    slurm_cfg = example_config("individual_part")["slurm"]
    with pytest.raises(ValueError):
        gen.generate_slurm_script(slurm_cfg, workspace="/ws", start_mode="bogus")


@pytest.mark.parametrize("profile", PROFILES)
def test_reference_velocity_propagates(profile: str):
    # The configured freestream (15.65) must reach the reference values and the
    # inlet BC — a guard against the reference plumbing silently dropping it.
    arts = render_profile_artifacts(profile)
    solver = arts["solver_from_case.jou"]
    assert "/report/reference-values/velocity 15.65" in solver
    assert "velocity-inlet inlet" in solver


# ── M2 correctness fixes (AUDIT C2/C3/C4/C5/C7) ───────────────────────────


@pytest.mark.parametrize("profile", PROFILES)
@pytest.mark.parametrize("journal", ("solver_from_case.jou", "combined.jou"))
def test_reference_density_is_set(profile: str, journal: str):
    # AUDIT C4: density is required for physical coefficients; it was never set.
    assert "/report/reference-values/density" in render_profile_artifacts(profile)[journal]


@pytest.mark.parametrize("profile", PROFILES)
@pytest.mark.parametrize("journal", ("solver_from_case.jou", "combined.jou"))
def test_forces_are_body_scoped_not_wildcard(profile: str, journal: str):
    # AUDIT C3: force reports must target the body wall pattern, not all walls.
    content = render_profile_artifacts(profile)[journal]
    assert "thread-names wall-body*" in content
    assert "thread-names * ()" not in content  # no force report over every wall


@pytest.mark.parametrize("profile", PROFILES)
def test_force_plateau_convergence_emitted(profile: str):
    # AUDIT C5: the force-monitor window/tolerance are now wired into convergence.
    content = render_profile_artifacts(profile)["solver_from_case.jou"]
    assert "/solve/convergence-conditions/add" in content
    assert "report-def drag_force" in content


@pytest.mark.parametrize("profile", PROFILES)
def test_combined_contour_surfaces_not_empty(profile: str):
    # AUDIT C7: the combined journal used to render `surfaces  ()` (undefined
    # zone vars). Every contour surface line must now name at least one surface.
    content = render_profile_artifacts(profile)["combined.jou"]
    for line in content.splitlines():
        if line.startswith("/display/set/contours/surfaces"):
            inner = line[len("/display/set/contours/surfaces"):].strip()
            assert inner not in ("()", ""), f"empty contour surface line: {line!r}"


def test_full_car_has_symmetry_plane():
    # AUDIT C9: the half-car run must define a symmetry plane.
    content = render_profile_artifacts("full_car")["solver_from_case.jou"]
    assert "/define/boundary-conditions/zone-type symmetry symmetry" in content


# ── M4 SLURM multi-node + per-profile sizing (AUDIT S1) ───────────────────


@pytest.mark.parametrize("profile", PROFILES)
@pytest.mark.parametrize("script", SLURM_FILES)
def test_multinode_launch_flags(profile: str, script: str):
    # AUDIT S1: the launch must build a hostfile and pass MPI + interconnect +
    # -cnf, otherwise multi-node jobs silently run on a single node.
    sh = render_profile_artifacts(profile)[script]
    assert 'scontrol show hostnames "$SLURM_JOB_NODELIST"' in sh
    assert "-mpi=intel" in sh
    assert "-pib" in sh
    assert "-cnf=$HOSTFILE" in sh
    assert "${MPI_FLAGS}" in sh  # the fluent line actually uses the flags


def test_per_profile_slurm_sizing():
    comp = render_profile_artifacts("individual_part")["run_solver.sh"]
    full = render_profile_artifacts("full_car")["run_solver.sh"]
    assert "#SBATCH --nodes=1" in comp and "#SBATCH --time=06:00:00" in comp
    assert "#SBATCH --nodes=2" in full and "#SBATCH --time=24:00:00" in full


# ── M5 mesh workflow selection + prism wiring (AUDIT C6/C11) ──────────────


def test_mesh_workflow_selection():
    gen = JournalGenerator()
    base = example_config("individual_part")["mesh"]
    wt = gen.generate_mesh_journal({**base, "workflow": "watertight"}, "g", "/ws")
    ft = gen.generate_mesh_journal({**base, "workflow": "fault-tolerant"}, "g", "/ws")
    assert "Watertight Geometry" in wt and "Fault-tolerant Meshing" not in wt
    assert "Fault-tolerant Meshing" in ft


def test_mesh_workflow_unknown_raises():
    gen = JournalGenerator()
    base = example_config("individual_part")["mesh"]
    with pytest.raises(ValueError):
        gen.generate_mesh_journal({**base, "workflow": "bogus"}, "g", "/ws")


def test_per_profile_mesh_workflow():
    comp = render_profile_artifacts("individual_part")["mesh_only.jou"]
    full = render_profile_artifacts("full_car")["mesh_only.jou"]
    assert "Watertight Geometry" in comp
    assert "Fault-tolerant Meshing" in full


def test_prism_layer_count_from_config():
    # AUDIT C6: volume_mesh.num_layers must reach the Add Boundary Layers task
    # in the WATERTIGHT path (it was previously ignored). The fault-tolerant/VWT
    # path currently uses the ARC-proven bare 'Generate Boundary Layers' —
    # wiring num_layers there needs the FTM Add Boundary Layers child pattern,
    # which is a flagged cluster-validation item (docs/CLUSTER_FINDINGS.md).
    mesh = render_profile_artifacts("individual_part")["mesh_only.jou"]
    assert "'NumberOfLayers': 15" in mesh


def test_ft_template_uses_proven_vwt_sequence():
    # The FT journal must carry the ARC-proven sequence (probes 6372187-6378056).
    mesh = render_profile_artifacts("full_car")["mesh_only.jou"]
    for line in (
        "PartManagement.InputFileChanged",
        "PMFileManagement.FileManager.LoadFiles()",
        "'ModelingObjective': r'Virtual Wind Tunnel'",
        "'CreationMethod': r'Use existing boundary'",
        "'MptMethodType': r'Centroid of Objects'",
        "'ComputeSizeFieldControl': r'yes'",
        "Generate Boundary Layers",
    ):
        assert line in mesh, f"proven VWT step missing: {line}"


def test_first_layer_height_opt_in():
    # F9: FirstHeight is emitted only when first_layer_height_mm is set, so the
    # proven SOP prism defaults are untouched otherwise.
    gen = JournalGenerator()
    base = example_config("individual_part")["mesh"]

    def commands(journal: str) -> str:
        # Command lines only — template comments mention FirstHeight too.
        return "\n".join(
            ln for ln in journal.splitlines() if ln.strip() and not ln.strip().startswith(";")
        )

    default = commands(gen.generate_mesh_journal(base, "g", "/ws"))
    assert "FirstHeight" not in default

    custom = {**base, "volume_mesh": {**base["volume_mesh"], "first_layer_height_mm": 0.05}}
    wired = commands(gen.generate_mesh_journal(custom, "g", "/ws"))
    assert "'FirstHeight': 0.05" in wired


def test_full_car_has_pressure_outlet():
    # F4 (maintainer-confirmed): the full_car preset must include an outlet.
    content = render_profile_artifacts("full_car")["solver_from_case.jou"]
    assert "/define/boundary-conditions/zone-type outlet pressure-outlet" in content


def test_named_selection_graceful_degradation():
    # A bare component config with no wheels/ground/outlet must not emit those
    # commands or crash (AUDIT: scheme must degrade when a zone is absent).
    gen = JournalGenerator()
    cfg = example_config("individual_part")
    cfg["solver"]["boundary_conditions"] = {
        "velocity_inlets": [{"zone_name": "inlet", "velocity": 15.65,
                             "turbulent_intensity_pct": 5.0, "turbulent_viscosity_ratio": 10.0}],
        "pressure_outlets": [], "translating_walls": [], "rotating_walls": [],
        "slip_walls": [], "stationary_walls": [], "symmetry_planes": [],
    }
    out = gen.generate_solver_journal(cfg["solver"], "/ws/mesh.cas.h5", "/ws")
    # Inspect command (non-comment) lines only — the BC partial documents the TUI
    # format in comments, which would false-match a raw substring search.
    cmds = "\n".join(
        ln for ln in out.splitlines() if ln.strip() and not ln.strip().startswith(";")
    )
    assert "/define/boundary-conditions/wall " not in cmds   # no ground/wheel/slip walls
    assert "zone-type symmetry symmetry" not in cmds         # no symmetry plane
    assert out.rstrip().endswith("/exit yes")                # still a complete journal
