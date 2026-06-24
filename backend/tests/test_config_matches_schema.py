"""Cross-check: the run-profile engine + schema produce the example configs.

This guards two things at once:
  1. ``apply_cfd_mode_defaults`` (now reading from profiles.yaml) still yields the
     exact preset it did before the M1 refactor.
  2. ``app/journal/example_configs.py`` (used by the golden tests) faithfully
     mirrors that schema output, so the golden suite can't silently drift from
     the real defaults.

It needs Pydantic (the schema layer), so it is skipped in a jinja2-only env and
runs for real in Docker / any full dev environment.
"""

from __future__ import annotations

import pytest

pytest.importorskip("pydantic", reason="schema layer needs pydantic")

from app.journal.example_configs import PROFILES, example_config  # noqa: E402
from app.schemas.job import (  # noqa: E402
    MeshConfig,
    SlurmConfig,
    SolverConfig,
    apply_cfd_mode_defaults,
    apply_cfd_mode_mesh_defaults,
    apply_cfd_mode_slurm_defaults,
)


@pytest.mark.parametrize("mode", PROFILES)
def test_apply_defaults_matches_example_solver(mode: str):
    resolved = apply_cfd_mode_defaults(mode, SolverConfig())
    assert resolved.model_dump() == example_config(mode)["solver"], (
        f"apply_cfd_mode_defaults({mode!r}) drifted from example_configs. If the "
        f"profile preset changed intentionally, update example_configs.py and "
        f"regenerate goldens (UPDATE_GOLDEN=1)."
    )


@pytest.mark.parametrize("mode", PROFILES)
def test_apply_slurm_defaults_matches_example_slurm(mode: str):
    resolved = apply_cfd_mode_slurm_defaults(mode, SlurmConfig())
    assert resolved.model_dump() == example_config(mode)["slurm"], (
        f"apply_cfd_mode_slurm_defaults({mode!r}) drifted from example_configs."
    )


@pytest.mark.parametrize("mode", PROFILES)
def test_apply_mesh_defaults_matches_example_mesh(mode: str):
    resolved = apply_cfd_mode_mesh_defaults(mode, MeshConfig())
    assert resolved.model_dump() == example_config(mode)["mesh"], (
        f"apply_cfd_mode_mesh_defaults({mode!r}) drifted from example_configs."
    )


@pytest.mark.parametrize("mode", PROFILES)
def test_apply_defaults_is_idempotent(mode: str):
    once = apply_cfd_mode_defaults(mode, SolverConfig())
    twice = apply_cfd_mode_defaults(mode, SolverConfig(**once.model_dump()))
    assert once.model_dump() == twice.model_dump()
