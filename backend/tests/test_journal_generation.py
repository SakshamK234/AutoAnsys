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
