"""Representative example configs for the dry-run/``--validate`` tool and tests.

These mirror what ``JobService.create_job`` stores on a job — i.e. the dict
``{"cfd_mode", "mesh", "solver", "slurm"}`` where ``solver`` has already been
through ``apply_cfd_mode_defaults`` — for both run profiles.

IMPORTANT: these are **previews / fixtures**, not the production source of truth.
The real defaults live in ``app/schemas/job.py`` (Pydantic models +
``apply_cfd_mode_defaults``). This module exists so the journal/SLURM generator
can be rendered and inspected with **no** pydantic / DB / cluster dependency
(jinja2 only), which is what makes the Fluent-free tests and the dry-run runnable
anywhere. ``tests/test_config_matches_schema`` cross-checks these against the real
schema whenever the full stack is importable, so they cannot silently drift.

They track the schema as it evolves. As of M2 they include the correctness fixes
(reference density, half-car symmetry plane + force factor, body-scoped force
reports). Remaining known gaps stay visible (e.g. full_car still has no pressure
outlet pending F4, reference area 0.65 pending F1). Schema + fixtures change
together, and the golden-file diffs make each change reviewable.
"""

from __future__ import annotations

import copy


# ── Shared building blocks ────────────────────────────────────────────────

_MESH: dict = {
    "local_sizing": [],
    "refinement_regions": [],
    "surface_mesh": {
        "min_size": 2.0,
        "max_size": 264.0,
        "curvature_normal_angle": 18.0,
        "growth_rate": 1.2,
    },
    "volume_mesh": {
        "max_cell_length": 0.15,
        "growth_rate": 1.2,
        # F9: opt-in absolute first prism height (mm) for wall-resolved y+ ≈ 1;
        # None keeps the proven SOP last-ratio defaults.
        "first_layer_height_mm": None,
        "first_layer_height": 5e-05,  # deprecated, never emitted
        "num_layers": 15,
        "bl_growth_rate": 1.2,
        "prism_labels": [],
        "fill": "default",
        "hex_max_cell_length": None,
    },
    "wind_tunnel": {
        "x_min": -5.0, "x_max": 15.0,
        "y_min": 0.0, "y_max": 5.0,
        "z_min": -3.0, "z_max": 3.0,
    },
    "enclosure": {
        "back_mm": 8000.0, "front_mm": 1000.0,
        "top_mm": 2500.0, "bottom_mm": 2500.0,
        "left_mm": 2500.0, "right_mm": 2500.0,
        "flow_axis": "+x",
    },
    "mesh_quality": {
        "surface_skewness_threshold": 0.6,
        "volume_orthogonal_quality_threshold": 0.15,
        "auto_improve": True,
        "improve_volume": True,
        "sq_min_size": None,
    },
    "geometry_unit": "mm",
    "workflow": "watertight",
    "build_enclosure": False,
    "original_zones": ["inlet", "outlet", "ground", "symmetry", "walls"],
    "describe_setup_type": "default",
    "wall_to_internal": False,
    "pin_cad_import_options": True,
    # FT wrap full-car recipe (fc13→fc28) — off by default (component path).
    "delete_bodies": [],
    "prewrap_shell_split": False,
    "prewrap_shell_zone": 6,
    "scoped_sizing": None,
    "classify_boundaries": False,
    "carve_domain": None,
}


def _face_sizing(name: str, size: float, faces: list[str]) -> dict:
    """Specialist full-car face sizing (CellsPerGap 1, curvature angle 18°)."""
    return {
        "name": name, "type": "face_sizing", "category": None,
        "size": size, "growth_rate": 1.2,
        "x_min": None, "x_max": None, "y_min": None, "y_max": None,
        "z_min": None, "z_max": None,
        "face_zones": faces,
        "cells_per_gap": 1, "curvature_normal_angle": 18.0,
    }


def _wake_box(name: str, labels: list[str], **ratios: float) -> dict:
    """Specialist tire-wake box: ratio-relative to the labels' bounding box."""
    box = {
        "name": name, "max_size": 5.0, "labels": labels,
        "x_min_ratio": 0.1, "x_max_ratio": 0.1,
        "y_min_ratio": 0.1, "y_max_ratio": 0.1,
        "z_min_ratio": 0.1, "z_max_ratio": 0.1,
        "x_min": None, "x_max": None, "y_min": None, "y_max": None,
        "z_min": None, "z_max": None,
    }
    box.update({f"{k}_ratio": v for k, v in ratios.items()})
    return box


# Full car: fault-tolerant WRAP recipe, validated end-to-end as the fc-series
# (fc13→fc28; drag 316 N / downforce 970 N). Mirrors profiles.yaml full_car.mesh
# — the production source of truth. The specialist watertight replay was
# abandoned (sliver trailing edges); the wrap is immune to slivers + duplicate
# solids and produces the classifier's car/car-shell + tunnel-plane zones.
_MESH_OVERRIDES: dict = {
    # Component: FT wrap + geometric classifier (no carve — the part floats).
    "individual_part": {
        "workflow": "fault-tolerant",
        "classify_boundaries": True,
        "scoped_sizing": {
            "min_size": 2.0, "max_size": 16.0, "growth_rate": 1.2,
            "curvature_normal_angle": 18.0, "cells_per_gap": 3,
        },
    },
    "full_car": {
        "workflow": "fault-tolerant",
        "geometry_unit": "mm",
        "delete_bodies": ["bounding_box"],
        "prewrap_shell_split": True,
        "prewrap_shell_zone": 6,
        "scoped_sizing": {
            "min_size": 2.0, "max_size": 16.0, "growth_rate": 1.2,
            "curvature_normal_angle": 18.0, "cells_per_gap": 3,
        },
        "classify_boundaries": True,
        "carve_domain": {
            "x_min": -12.454, "x_max": 3.941,
            "y_min": 0.0, "y_max": 3.209,
            "z_min": 0.0, "z_max": 3.726,
            "margin": 0.006, "rim_margin": 0.04, "epsilon": 0.001,
        },
    },
}


def _mesh_for(cfd_mode: str) -> dict:
    m = copy.deepcopy(_MESH)
    m.update(_MESH_OVERRIDES.get(cfd_mode, {}))
    return m

_SOLUTION_METHODS: dict = {
    "scheme": "Coupled",
    "gradient": "least-squares-cell-based",
    "pressure": "second-order",
    "momentum": "second-order-upwind",
    "turbulent_kinetic_energy": "second-order-upwind",
    "specific_dissipation_rate": "second-order-upwind",
}

_DATA_EXPORT: dict = {
    "forces_csv": True,
    "residuals_csv": True,
    "case_data": True,
    "surface_data": ["pressure", "wall-shear"],
}

# Both SOP profiles run a half-domain with a centreline symmetry plane, so forces
# are doubled in post (AUDIT C1).
_SYMMETRY: dict = {"half_model": True, "force_factor": 2.0}

_REPORTING: dict = {
    "body_wall_pattern": "wall-body*",
    "emit_forces_newtons": True,
    "emit_coefficients": True,
    "moment_center_x": 0.0,
    "moment_center_y": 0.0,
    "moment_center_z": 0.0,
}

# Per-profile SLURM (mirrors apply_cfd_mode_slurm_defaults): component = 1 node /
# 6 h, full car = 2 nodes / 24 h. Intel MPI + InfiniBand (F6).
_SLURM_BASE: dict = {
    "nodes": 1,
    "cores_per_node": 128,
    "memory_gb": 243,
    "walltime_hours": 24,
    "partition": "normal_q",
    "account": "your_slurm_account",
    "job_name": "autoansys_cfd",
    "mpi": "intel",
    "interconnect": "infiniband",
}

_SLURM_OVERRIDES: dict = {
    "individual_part": {"nodes": 1, "walltime_hours": 6},
    "full_car": {"nodes": 2, "walltime_hours": 24},
}


def _slurm_for(cfd_mode: str) -> dict:
    s = copy.deepcopy(_SLURM_BASE)
    s.update(_SLURM_OVERRIDES.get(cfd_mode, {}))
    return s


def _inlet(zone: str = "inlet") -> dict:
    return {
        "zone_name": zone,
        "velocity": 15.65,
        "turbulent_intensity_pct": 5.0,
        "turbulent_viscosity_ratio": 10.0,
    }


def _ground(zone: str = "ground") -> dict:
    return {
        "zone_name": zone,
        "velocity_mps": 15.65,
        "direction_x": -1.0, "direction_y": 0.0, "direction_z": 0.0,
    }


# ── Individual part ───────────────────────────────────────────────────────

_INDIVIDUAL_PART_SOLVER: dict = {
    "general": {
        "solver_type": "pressure-based",
        "time": "steady",
        "velocity_formulation": "absolute",
    },
    "turbulence": {
        "model": "k-omega-sst",
        "near_wall_treatment": "auto",
        "curvature_correction": True,
    },
    # BCs reference the FT component classifier's zone names (probe33):
    # inlet/outlet/symmetry + farfield-top/side (slip) + ground/body (walls).
    "boundary_conditions": {
        "velocity_inlets": [_inlet()],
        "pressure_outlets": [{"zone_name": "outlet", "gauge_pressure": 0.0}],
        "translating_walls": [],
        "rotating_walls": [],
        "slip_walls": [
            {"zone_name": "farfield-top"},
            {"zone_name": "farfield-side"},
        ],
        "stationary_walls": [
            {"zone_name": "ground"},
            {"zone_name": "body"},
        ],
        "symmetry_planes": [{"zone_name": "symmetry"}],
    },
    "solution_methods": copy.deepcopy(_SOLUTION_METHODS),
    "convergence": {
        "residual_target": 1e-4,
        "max_iterations": 300,
        "force_monitor_window": 100,
        "force_monitor_tolerance": 0.001,
        "use_force_convergence": True,
    },
    "data_export": copy.deepcopy(_DATA_EXPORT),
    "reference_values": {
        "area_m2": 1.2, "length_m": 2.8, "velocity_mps": 15.65, "density_kg_m3": 1.225,
    },
    "symmetry": copy.deepcopy(_SYMMETRY),
    # Forces integrate over the classifier's merged part zone.
    "reporting": {**copy.deepcopy(_REPORTING), "body_wall_pattern": "body"},
    "initialization": "hybrid",
}


# ── Full car (mirrors apply_cfd_mode_defaults: area 0.65, 750 iters,
#    wheels + slip walls, and — per AUDIT.md C8/C9 — NO outlet, NO symmetry) ─

_FULL_CAR_SOLVER: dict = {
    "general": {
        "solver_type": "pressure-based",
        "time": "steady",
        "velocity_formulation": "absolute",
    },
    "turbulence": {
        "model": "k-omega-sst",
        "near_wall_treatment": "auto",
        "curvature_correction": True,
    },
    # BCs reference the FT classifier's zone names (fc28), not the CAD.
    # BASELINE: stationary ground + non-rotating wheels (car merged into one
    # 'car' zone + 'car-shell' imprint; carved ground/rim strips default to
    # stationary walls). Moving ground / rotating wheels come with the
    # specialist comparison conditions + per-component wheel separation.
    "boundary_conditions": {
        "velocity_inlets": [_inlet()],
        "pressure_outlets": [{"zone_name": "outlet", "gauge_pressure": 0.0}],
        "translating_walls": [],
        "rotating_walls": [],
        "slip_walls": [
            {"zone_name": "farfield-top"},
            {"zone_name": "farfield-side"},
        ],
        "stationary_walls": [
            {"zone_name": "car"},
            {"zone_name": "car-shell"},
        ],
        # Half-car centreline symmetry plane (AUDIT C9).
        "symmetry_planes": [{"zone_name": "symmetry"}],
    },
    "solution_methods": copy.deepcopy(_SOLUTION_METHODS),
    "convergence": {
        "residual_target": 1e-4,
        "max_iterations": 750,
        "force_monitor_window": 100,
        "force_monitor_tolerance": 0.001,
        "use_force_convergence": True,
    },
    "data_export": copy.deepcopy(_DATA_EXPORT),
    # F1: FULL frontal area 1.0 m²; reference length = wheelbase (60.5 in).
    "reference_values": {
        "area_m2": 1.0, "length_m": 1.5367, "velocity_mps": 15.65, "density_kg_m3": 1.225,
    },
    "symmetry": copy.deepcopy(_SYMMETRY),
    # Forces integrate over the classifier's car zones (fc28: car + car-shell).
    "reporting": {**copy.deepcopy(_REPORTING), "body_wall_pattern": "car car-shell"},
    "initialization": "hybrid",
}


def example_config(cfd_mode: str) -> dict:
    """Return a deep copy of the full stored-config dict for a run profile.

    Shape matches ``Job.config``: ``{"cfd_mode", "mesh", "solver", "slurm"}``.
    """
    if cfd_mode == "individual_part":
        solver = _INDIVIDUAL_PART_SOLVER
    elif cfd_mode == "full_car":
        solver = _FULL_CAR_SOLVER
    else:
        raise ValueError(f"Unknown cfd_mode {cfd_mode!r}")
    return copy.deepcopy({
        "cfd_mode": cfd_mode,
        "mesh": _mesh_for(cfd_mode),
        "solver": solver,
        "slurm": _slurm_for(cfd_mode),
    })


PROFILES: tuple[str, ...] = ("individual_part", "full_car")
