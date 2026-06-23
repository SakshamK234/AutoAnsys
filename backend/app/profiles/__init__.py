"""Run-profile loader — the single source of truth for per-profile presets.

Loads ``profiles.yaml`` (shared ``defaults`` deep-merged with the selected
``profiles.<mode>`` override) and exposes the resolved preset dict. Depends only
on PyYAML, so it is importable and testable without the full app stack.

The Pydantic schema layer (``app.schemas.job.apply_cfd_mode_defaults``) consumes
``resolve_profile(mode)`` to seed boundary conditions, iteration count, and
reference area — replacing what used to be hardcoded Python literals.
"""

from __future__ import annotations

import copy
from functools import lru_cache
from pathlib import Path

import yaml

_PROFILES_PATH = Path(__file__).parent / "profiles.yaml"


class UnknownProfileError(ValueError):
    """Raised when a run profile name is not defined in profiles.yaml."""


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge ``override`` onto a copy of ``base``.

    Dicts merge key-by-key; every other type (including lists) is replaced
    wholesale — BC lists are profile-specific and must not be concatenated.
    """
    result = copy.deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


@lru_cache(maxsize=1)
def _load_raw() -> dict:
    with _PROFILES_PATH.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if "profiles" not in data:
        raise ValueError(f"{_PROFILES_PATH} is missing a top-level 'profiles' key")
    return data


def available_profiles() -> list[str]:
    """Names of the run profiles defined in profiles.yaml."""
    return sorted(_load_raw()["profiles"].keys())


def resolve_profile(mode: str) -> dict:
    """Return the fully resolved preset dict for ``mode`` (defaults + override).

    Raises UnknownProfileError if the mode is not defined.
    """
    raw = _load_raw()
    profiles = raw["profiles"]
    if mode not in profiles:
        raise UnknownProfileError(
            f"Unknown run profile {mode!r}; known: {sorted(profiles)}"
        )
    defaults = raw.get("defaults", {})
    return _deep_merge(defaults, profiles[mode] or {})
