"""Unit tests for the force/coefficient post-processing (pure, stdlib-only)."""

from __future__ import annotations

import math

from app.post.forces import (
    derive_coefficients,
    dynamic_pressure,
    process_force_rows,
    reference_kwargs_from_solver,
)


def test_dynamic_pressure():
    assert dynamic_pressure(1.225, 15.65) == 0.5 * 1.225 * 15.65 ** 2


def test_derive_coefficients_basic():
    # Choose q*A = 1 so coefficients equal the forces, for a clean check.
    # q = 0.5 * rho * V^2 ; pick rho, V, A so q*A = 1.
    rho, v = 2.0, 1.0          # q = 1.0
    area = 1.0                 # q*A = 1.0
    length = 2.0
    c = derive_coefficients(
        10.0, -30.0, 4.0,
        density_kg_m3=rho, velocity_mps=v, area_m2=area, length_m=length,
    )
    assert math.isclose(c["cd"], 10.0)
    assert math.isclose(c["cl"], -30.0)
    assert math.isclose(c["cm"], 4.0 / length)


def test_derive_coefficients_guards_zero_area():
    c = derive_coefficients(
        10.0, 10.0, 10.0,
        density_kg_m3=1.225, velocity_mps=15.65, area_m2=0.0, length_m=2.8,
    )
    assert c == {"cd": 0.0, "cl": 0.0, "cm": 0.0}


def test_symmetry_factor_doubles_forces_and_coefficients():
    raw = [{"iteration": 1, "drag_force": 100.0, "lift_force": -500.0, "mom_y": 20.0}]
    single = process_force_rows(raw, force_factor=1.0, area_m2=1.2)[0]
    doubled = process_force_rows(raw, force_factor=2.0, area_m2=1.2)[0]
    # Half-model doubling scales BOTH the reported force and the derived coeff.
    assert math.isclose(doubled["drag_n"], 2 * single["drag_n"])
    assert math.isclose(doubled["lift_n"], 2 * single["lift_n"])
    assert math.isclose(doubled["cd"], 2 * single["cd"])
    assert math.isclose(doubled["cl"], 2 * single["cl"])


def test_process_force_rows_missing_keys_default_zero():
    rows = process_force_rows([{"iteration": 5}], force_factor=2.0)
    assert rows[0]["iteration"] == 5
    assert rows[0]["drag_n"] == 0.0
    assert rows[0]["cd"] == 0.0


def test_process_force_rows_skips_unparseable_iteration():
    rows = process_force_rows([{"iteration": "n/a", "drag_force": 1.0}])
    assert rows == []


def test_reference_kwargs_from_solver_uses_config():
    cfg = {
        "reference_values": {
            "area_m2": 0.65, "length_m": 2.8, "velocity_mps": 20.0, "density_kg_m3": 1.2,
        },
        "symmetry": {"half_model": True, "force_factor": 2.0},
    }
    kw = reference_kwargs_from_solver(cfg)
    assert kw["force_factor"] == 2.0
    assert kw["area_m2"] == 0.65
    assert kw["velocity_mps"] == 20.0
    assert kw["density_kg_m3"] == 1.2


def test_reference_kwargs_defaults_for_legacy_config():
    # A pre-M2 job config has no symmetry/density keys → safe defaults, factor 1.
    kw = reference_kwargs_from_solver({"reference_values": {"area_m2": 1.2}})
    assert kw["force_factor"] == 1.0
    assert kw["density_kg_m3"] == 1.225
