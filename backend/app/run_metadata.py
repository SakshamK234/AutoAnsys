"""Per-run reproducibility metadata (AUDIT E5).

Every job/mesh submission writes a ``run_metadata.json`` into its cluster
workspace recording exactly what produced the run — the resolved config + run
profile, the Fluent module, the app git SHA, and a timestamp — so a result can
be reproduced or audited from the artifacts alone. The builder is a pure function
(stdlib only) and unit-tested; the task layer writes the JSON and stages it back.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

SCHEMA_VERSION = 1


def build_run_metadata(
    *,
    kind: str,
    entity_id: str,
    cfd_mode: str,
    config: dict,
    fluent_module: str,
    git_sha: str,
    generated_at: str | None = None,
) -> dict:
    """Build the reproducibility record for a job or mesh.

    ``kind`` is "job" or "mesh"; ``config`` is the resolved stored config
    (``{cfd_mode, mesh, solver, slurm}``). ``generated_at`` defaults to now (UTC).
    """
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": kind,
        "id": str(entity_id),
        "cfd_mode": cfd_mode,
        "fluent_module": fluent_module,
        "git_sha": git_sha or "unknown",
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
        "config": config,
    }


def to_json(metadata: dict) -> str:
    """Serialise a metadata record deterministically (sorted keys)."""
    return json.dumps(metadata, indent=2, sort_keys=True, default=str)
