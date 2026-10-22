"""Field-level validation for config strings that are rendered into Fluent
journals or SLURM batch scripts.

Every free-form string that leaves the API and lands inside a generated
artifact (``.jou``, ``assign.scm``, ``run.sh``) MUST pass through one of these
validators. The templates interpolate raw (Jinja autoescape is meaningless for
TUI/scheme/bash), so the schema layer is the injection boundary:

- journal strings may end up inside ``(%py-exec "...r'{{ x }}'...")`` — a quote
  breaks out into arbitrary Python executed by Fluent on the compute node;
- TUI lines — a newline injects arbitrary TUI/scheme, which can shell out;
- ``#SBATCH`` lines — a newline adds arbitrary bash run as the service account.

The character classes below are deliberately tight: Fluent zone names produced
by import/classification only ever contain ``[A-Za-z0-9_:.-]``, and SLURM
identifiers only need ``[A-Za-z0-9_-]``.
"""

from __future__ import annotations

import re

# Fluent zone / object / label name (also file-safe). No quotes, no whitespace,
# no scheme/python metacharacters.
_ZONE_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_:.\-]{0,99}$")

# Same as _ZONE_RE but allows ``*`` and ``?`` for Fluent thread-name patterns
# (e.g. ``wall-body*``, ``car-shell*``).
_ZONE_GLOB_RE = re.compile(r"^[A-Za-z0-9_*?][A-Za-z0-9_:.\-*?]{0,99}$")

# SLURM identifiers (#SBATCH --job-name / --account values).
_SLURM_IDENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$")


def zone_name(value: str, *, field: str = "zone name") -> str:
    """Validate a Fluent zone/object/label name destined for a journal."""
    value = str(value).strip()
    if not _ZONE_RE.match(value):
        raise ValueError(
            f"invalid {field} {value!r}: only letters, digits, '_', ':', '.', '-' "
            "are allowed (no spaces or quotes)"
        )
    return value


def zone_pattern(value: str, *, field: str = "zone pattern") -> str:
    """Validate a Fluent thread-name pattern (zone name, '*'/'?' allowed)."""
    value = str(value).strip()
    if not _ZONE_GLOB_RE.match(value):
        raise ValueError(
            f"invalid {field} {value!r}: only letters, digits, '_', ':', '.', '-', "
            "'*', '?' are allowed (no spaces or quotes)"
        )
    return value


def zone_name_list(values: list[str], *, field: str = "zone name") -> list[str]:
    return [zone_name(v, field=field) for v in values]


def zone_pattern_list(values: list[str], *, field: str = "zone pattern") -> list[str]:
    return [zone_pattern(v, field=field) for v in values]


def slurm_identifier(value: str, *, field: str = "identifier") -> str:
    """Validate a string rendered into an #SBATCH line."""
    value = str(value).strip()
    if not _SLURM_IDENT_RE.match(value):
        raise ValueError(
            f"invalid SLURM {field} {value!r}: only letters, digits, '_' and '-' "
            "are allowed (max 64 chars)"
        )
    return value


def one_of(value: str, allowed: tuple[str, ...], *, field: str) -> str:
    """Validate an enum-like string against a fixed allowlist."""
    value = str(value).strip()
    if value not in allowed:
        raise ValueError(f"invalid {field} {value!r}: must be one of {sorted(allowed)}")
    return value
