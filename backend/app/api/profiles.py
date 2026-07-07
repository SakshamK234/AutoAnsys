"""Run-profile preset endpoints.

Exposes the backend's single source of truth (app/profiles/profiles.yaml) so the
frontend can load per-mode defaults instead of maintaining a hand-written mirror
in constants.ts — the mirror already drifted once (its full_car preset lacked the
M2 symmetry plane). The wizard should treat these responses as authoritative.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.profiles import UnknownProfileError, available_profiles, resolve_profile
from app.schemas.job import (
    MeshConfig,
    SlurmConfig,
    SolverConfig,
    apply_cfd_mode_defaults,
    apply_cfd_mode_mesh_defaults,
    apply_cfd_mode_slurm_defaults,
)

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("")
async def list_profiles(
    current_user: User = Depends(get_current_user),
) -> dict:
    """List the available run-profile names."""
    return {"profiles": available_profiles()}


@router.get("/{mode}")
async def get_profile(
    mode: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the raw preset and the fully-resolved default configs for a mode.

    ``defaults`` is exactly what JobService would store for a job created with
    empty configs in this mode — i.e. what the wizard should pre-populate.
    """
    try:
        raw = resolve_profile(mode)
    except UnknownProfileError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown run profile '{mode}'",
        )
    return {
        "mode": mode,
        "preset": raw,
        "defaults": {
            "solver": apply_cfd_mode_defaults(mode, SolverConfig()).model_dump(),
            "slurm": apply_cfd_mode_slurm_defaults(mode, SlurmConfig()).model_dump(),
            "mesh": apply_cfd_mode_mesh_defaults(mode, MeshConfig()).model_dump(),
        },
    }
