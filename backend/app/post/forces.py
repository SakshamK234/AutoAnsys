"""Force/coefficient post-processing — pure functions, no I/O.

The solver journal writes FORCES in Newtons (drag_force, lift_force, mom_y),
integrated over the body wall zones only (see _reports_block.jou.j2). This module
turns those raw force rows into the values the UI reports:

  * applies the half-model **symmetry factor** (AUDIT C1) so half-car forces are
    reported as the full-car value, and
  * derives the non-dimensional **coefficients** Cd/Cl/Cm from the forces and the
    reference values (density ρ, velocity V, area A, length L), since the journal
    no longer relies on the version-specific coefficient-report TUI.

Coefficient definitions (q = ½ ρ V²):
    Cd = Fx / (q · A)
    Cl = Fz / (q · A)
    Cm = My / (q · A · L)

Because the reference area is the FULL frontal area while Fluent integrates over
the half model, both the force and the coefficient are at half their true value,
so multiplying both by ``force_factor`` (2.0 for a half model) is correct.

These functions are deliberately dependency-free (stdlib only) so the numerical
core is unit-tested without pydantic/boto3/Fluent. The S3/CSV I/O lives in the
service layer and calls in here.
"""

from __future__ import annotations

# Raw force-report column name -> output force key.
RAW_FORCE_KEYS = {
    "drag_force": "drag_n",
    "lift_force": "lift_n",
    "mom_y": "moment_nm",
}


def dynamic_pressure(density_kg_m3: float, velocity_mps: float) -> float:
    """q = ½ ρ V²."""
    return 0.5 * density_kg_m3 * velocity_mps * velocity_mps


def derive_coefficients(
    drag_n: float,
    lift_n: float,
    moment_nm: float,
    *,
    density_kg_m3: float,
    velocity_mps: float,
    area_m2: float,
    length_m: float,
) -> dict[str, float]:
    """Return {cd, cl, cm} from already-symmetry-corrected forces + reference values.

    Returns zeros if the dynamic-pressure / area / length normalisation would
    divide by zero (mis-configured reference values) rather than raising, so a
    single bad row can't blank an entire results page.
    """
    q = dynamic_pressure(density_kg_m3, velocity_mps)
    qa = q * area_m2
    if qa <= 0:
        return {"cd": 0.0, "cl": 0.0, "cm": 0.0}
    cm = moment_nm / (qa * length_m) if length_m > 0 else 0.0
    return {"cd": drag_n / qa, "cl": lift_n / qa, "cm": cm}


def process_force_rows(
    raw_rows: list[dict],
    *,
    force_factor: float = 1.0,
    density_kg_m3: float = 1.225,
    velocity_mps: float = 15.65,
    area_m2: float = 1.2,
    length_m: float = 2.8,
) -> list[dict]:
    """Convert raw per-iteration force rows into reported force + coefficient rows.

    ``raw_rows`` are dicts with at least ``iteration`` and any of
    ``drag_force``/``lift_force``/``mom_y`` (missing keys treated as 0.0). Each
    output row carries: iteration, drag_n, lift_n, moment_nm (symmetry-corrected
    forces) and cd, cl, cm (derived coefficients).
    """
    out: list[dict] = []
    for row in raw_rows:
        try:
            iteration = int(row.get("iteration", 0))
        except (TypeError, ValueError):
            continue
        drag_n = _as_float(row.get("drag_force")) * force_factor
        lift_n = _as_float(row.get("lift_force")) * force_factor
        moment_nm = _as_float(row.get("mom_y")) * force_factor
        coeffs = derive_coefficients(
            drag_n, lift_n, moment_nm,
            density_kg_m3=density_kg_m3, velocity_mps=velocity_mps,
            area_m2=area_m2, length_m=length_m,
        )
        out.append({
            "iteration": iteration,
            "drag_n": drag_n,
            "lift_n": lift_n,
            "moment_nm": moment_nm,
            **coeffs,
        })
    return out


def reference_kwargs_from_solver(solver_config: dict) -> dict:
    """Extract the post-processing reference kwargs from a stored solver config.

    Tolerant of missing keys (older/legacy job configs) — falls back to the M2
    schema defaults so a pre-M2 job still post-processes sanely.
    """
    rv = (solver_config or {}).get("reference_values", {}) or {}
    sym = (solver_config or {}).get("symmetry", {}) or {}
    return {
        "force_factor": _as_float(sym.get("force_factor"), 1.0),
        "density_kg_m3": _as_float(rv.get("density_kg_m3"), 1.225),
        "velocity_mps": _as_float(rv.get("velocity_mps"), 15.65),
        "area_m2": _as_float(rv.get("area_m2"), 1.2),
        "length_m": _as_float(rv.get("length_m"), 2.8),
    }


def _as_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default
