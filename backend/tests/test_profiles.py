"""Tests for the run-profile loader (app.profiles). PyYAML-only, runs anywhere."""

from __future__ import annotations

import pytest

from app.profiles import (
    UnknownProfileError,
    available_profiles,
    resolve_profile,
)


def test_both_profiles_available():
    assert set(available_profiles()) == {"individual_part", "full_car"}


def test_unknown_profile_raises():
    with pytest.raises(UnknownProfileError):
        resolve_profile("spaceship")


def test_defaults_are_merged_in():
    # `turbulence` lives only under defaults; it must appear in every profile.
    for mode in available_profiles():
        resolved = resolve_profile(mode)
        assert resolved["turbulence"]["model"] == "k-omega-sst"
        assert resolved["turbulence"]["curvature_correction"] is True
        # `velocity_mps`/`length_m` come from defaults.reference_values and merge
        # with the profile's own `area_m2`.
        assert resolved["reference_values"]["velocity_mps"] == 15.65
        assert resolved["reference_values"]["length_m"] == 2.8
        assert "area_m2" in resolved["reference_values"]


def test_individual_part_preset_values():
    p = resolve_profile("individual_part")
    assert p["reference_values"]["area_m2"] == 1.2
    assert p["convergence"]["max_iterations"] == 300
    bc = p["boundary_conditions"]
    assert bc["velocity_inlets"][0]["zone_name"] == "inlet"
    assert bc["velocity_inlets"][0]["velocity"] == 15.65
    assert bc["pressure_outlets"][0]["zone_name"] == "outlet"
    assert bc["translating_walls"][0]["zone_name"] == "ground"
    assert bc["translating_walls"][0]["direction_x"] == -1.0
    assert bc["symmetry_planes"][0]["zone_name"] == "symmetry"
    assert bc["stationary_walls"][0]["zone_name"] == "walls"
    # Component is run half-domain with a symmetry plane → doubling factor (C1).
    assert p["symmetry"]["force_factor"] == 2.0


def test_full_car_preset_values():
    p = resolve_profile("full_car")
    assert p["reference_values"]["area_m2"] == 0.65
    assert p["convergence"]["max_iterations"] == 750
    bc = p["boundary_conditions"]
    wheels = {w["zone_name"]: w for w in bc["rotating_walls"]}
    assert set(wheels) == {"front-tire", "rear-tire"}
    assert wheels["front-tire"]["omega_rad_s"] == 77.0
    assert wheels["front-tire"]["axis_y"] == 1.0
    assert wheels["rear-tire"]["origin_x"] == -0.7056
    slip = {s["zone_name"] for s in bc["slip_walls"]}
    assert slip == {"tunnel-walls", "contact-patches"}
    # M2 fix (AUDIT C9): half-car run now carries a centreline symmetry plane,
    # paired with the doubling factor below.
    assert bc["symmetry_planes"][0]["zone_name"] == "symmetry"
    assert p["symmetry"]["half_model"] is True
    assert p["symmetry"]["force_factor"] == 2.0
    # Still open (AUDIT C8 / F4): no pressure outlet in the specialist preset.
    assert bc.get("pressure_outlets") is None


def test_resolve_returns_independent_copies():
    # Mutating one resolution must not leak into the cached raw data.
    a = resolve_profile("full_car")
    a["convergence"]["max_iterations"] = 99999
    b = resolve_profile("full_car")
    assert b["convergence"]["max_iterations"] == 750
