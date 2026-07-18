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
        # `velocity_mps` comes from defaults.reference_values and merges with the
        # profile's own `area_m2`/`length_m` overrides.
        assert resolved["reference_values"]["velocity_mps"] == 15.65
        assert "area_m2" in resolved["reference_values"]
        assert "length_m" in resolved["reference_values"]


def test_individual_part_preset_values():
    p = resolve_profile("individual_part")
    assert p["reference_values"]["area_m2"] == 1.2
    assert p["convergence"]["max_iterations"] == 300
    bc = p["boundary_conditions"]
    # FT component classifier zone names (probe33): inlet/outlet/symmetry +
    # farfield-top/side (slip) + ground/body (stationary walls). No moving
    # ground / rotating parts.
    assert bc["velocity_inlets"][0]["zone_name"] == "inlet"
    assert bc["velocity_inlets"][0]["velocity"] == 15.65
    assert bc["pressure_outlets"][0]["zone_name"] == "outlet"
    assert not bc.get("translating_walls")
    slip = {s["zone_name"] for s in bc["slip_walls"]}
    assert slip == {"farfield-top", "farfield-side"}
    walls = {w["zone_name"] for w in bc["stationary_walls"]}
    assert walls == {"ground", "body"}
    assert bc["symmetry_planes"][0]["zone_name"] == "symmetry"
    assert p["reporting"]["body_wall_pattern"] == "body"
    # Component is run half-domain with a symmetry plane → doubling factor (C1).
    assert p["symmetry"]["force_factor"] == 2.0


def test_full_car_preset_values():
    p = resolve_profile("full_car")
    # F1 (maintainer-provided): FULL frontal area 1.0 m²; length = wheelbase
    # 60.5 in = 1.5367 m. Pairs with the half-model force doubling.
    assert p["reference_values"]["area_m2"] == 1.0
    assert p["reference_values"]["length_m"] == 1.5367
    assert p["convergence"]["max_iterations"] == 750
    bc = p["boundary_conditions"]
    # FT classifier zone names (fc28), BASELINE BCs: the car body is the merged
    # 'car' + 'car-shell' stationary walls; tunnel top/side are slip walls; NO
    # rotating wheels / moving ground yet (pending specialist conditions).
    assert not bc.get("rotating_walls")
    assert not bc.get("translating_walls")
    walls = {w["zone_name"] for w in bc["stationary_walls"]}
    assert walls == {"car", "car-shell"}
    slip = {s["zone_name"] for s in bc["slip_walls"]}
    assert slip == {"farfield-top", "farfield-side"}
    # Half-car run carries a centreline symmetry plane, paired with the doubling.
    assert bc["symmetry_planes"][0]["zone_name"] == "symmetry"
    assert p["symmetry"]["half_model"] is True
    assert p["symmetry"]["force_factor"] == 2.0
    assert bc["pressure_outlets"][0]["zone_name"] == "outlet"
    # Forces integrate over the classifier's car zones.
    assert p["reporting"]["body_wall_pattern"] == "car car-shell"


def test_per_profile_slurm_presets():
    comp = resolve_profile("individual_part")["slurm"]
    full = resolve_profile("full_car")["slurm"]
    assert comp["nodes"] == 1 and comp["walltime_hours"] == 6
    assert full["nodes"] == 2 and full["walltime_hours"] == 24


def test_per_profile_mesh_workflow():
    # Both profiles run fault-tolerant WRAP + geometric classifier on raw
    # geometry. Component = classify, NO carve (part floats). Full car =
    # fc13→fc28 recipe: junk-body delete, pre-wrap split, scoped sizing,
    # classify + slab carve (ground fuses with the wheels).
    comp = resolve_profile("individual_part")["mesh"]
    assert comp["workflow"] == "fault-tolerant"
    assert comp["classify_boundaries"] is True
    assert comp.get("carve_domain") is None
    assert not comp.get("delete_bodies")
    assert comp["scoped_sizing"]["min_size"] == 2.0
    full = resolve_profile("full_car")["mesh"]
    assert full["workflow"] == "fault-tolerant"
    assert full["delete_bodies"] == ["bounding_box"]
    assert full["prewrap_shell_split"] is True
    assert full["classify_boundaries"] is True
    assert full["scoped_sizing"]["min_size"] == 2.0
    assert full["carve_domain"]["x_min"] == -12.454


def test_resolve_returns_independent_copies():
    # Mutating one resolution must not leak into the cached raw data.
    a = resolve_profile("full_car")
    a["convergence"]["max_iterations"] = 99999
    b = resolve_profile("full_car")
    assert b["convergence"]["max_iterations"] == 750
