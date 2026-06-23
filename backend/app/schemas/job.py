"""Job request and response schemas with nested config models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.profiles import UnknownProfileError, resolve_profile


# ── Mesh Configuration ────────────────────────────────────────────────────


class LocalSizingRegion(BaseModel):
    """A single body-of-influence or face sizing region.

    Categories match the FSAE SOPs:
      - aero / chassis / wheels / intake  (local sizings, SOP Individual Part + Kevin Full Car)
      - nearfield / farfield / rear_wing  (local refinement regions, Kevin Full Car)
    """

    name: str
    type: str = "body_of_influence"  # body_of_influence | face_sizing
    category: str | None = None  # aero | chassis | wheels | intake | nearfield | farfield | rear_wing
    size: float = 0.02
    growth_rate: float = 1.2
    # BOI-specific
    x_min: float | None = None
    x_max: float | None = None
    y_min: float | None = None
    y_max: float | None = None
    z_min: float | None = None
    z_max: float | None = None
    # Face-sizing-specific
    face_zones: list[str] = []


class SurfaceMeshConfig(BaseModel):
    # Sizes are interpreted in the MeshConfig.geometry_unit (default mm).
    # Reference journal (SOP) used MinSize=2 mm, MaxSize=264 mm.
    min_size: float = 2.0
    max_size: float = 264.0
    curvature_normal_angle: float = 18.0
    growth_rate: float = 1.2


class VolumeMeshConfig(BaseModel):
    max_cell_length: float = 0.15
    growth_rate: float = 1.2
    # Boundary-layer params
    first_layer_height: float = 5e-5
    num_layers: int = 15
    bl_growth_rate: float = 1.2


class WindTunnelConfig(BaseModel):
    x_min: float = -5.0
    x_max: float = 15.0
    y_min: float = 0.0
    y_max: float = 5.0
    z_min: float = -3.0
    z_max: float = 3.0


class EnclosureConfig(BaseModel):
    """Documentation-only record of the enclosure the user built in Discovery.

    Per the FSAE SOP, the enclosure is created IN DISCOVERY before exporting the
    Parasolid — Fluent Meshing does NOT run a capping step. These values are
    captured here for auditability / sweep reproducibility, not to drive Fluent.

    Defaults from CFD_SOP (Individual Part): back 8000, front 1000, rest 2500 mm.
    Kevin Full Car reference also uses front 1000.
    """

    back_mm: float = 8000.0
    front_mm: float = 1000.0
    top_mm: float = 2500.0
    bottom_mm: float = 2500.0
    left_mm: float = 2500.0
    right_mm: float = 2500.0
    # Direction the car nose points along (informational).
    flow_axis: str = "+x"


class MeshQuality(BaseModel):
    """Mesh quality thresholds with optional auto-improve (per SOP)."""

    surface_skewness_threshold: float = 0.6
    volume_orthogonal_quality_threshold: float = 0.15
    auto_improve: bool = True


class MeshConfig(BaseModel):
    local_sizing: list[LocalSizingRegion] = []
    surface_mesh: SurfaceMeshConfig = Field(default_factory=SurfaceMeshConfig)
    volume_mesh: VolumeMeshConfig = Field(default_factory=VolumeMeshConfig)
    wind_tunnel: WindTunnelConfig = Field(default_factory=WindTunnelConfig)
    enclosure: EnclosureConfig | None = Field(default_factory=EnclosureConfig)
    mesh_quality: MeshQuality = Field(default_factory=MeshQuality)
    geometry_unit: str = "mm"
    # Face labels the user applied in Discovery to the Parasolid export.
    # Passed as Generate Surface Mesh `OriginalZones` so Fluent preserves them
    # through meshing. Matches the FSAE SOP convention exactly.
    original_zones: list[str] = Field(
        default_factory=lambda: [
            "inlet",
            "outlet",
            "ground",
            "symmetry",
            "walls",
        ]
    )


# ── Solver Configuration ─────────────────────────────────────────────────


class GeneralSolverConfig(BaseModel):
    solver_type: str = "pressure-based"
    time: str = "steady"
    velocity_formulation: str = "absolute"


class TurbulenceConfig(BaseModel):
    model: str = "k-omega-sst"
    near_wall_treatment: str = "auto"
    # Per Kevin Full Car + Individual Part SOPs: enable curvature correction on k-omega SST.
    curvature_correction: bool = True


# ── Boundary-condition primitives ────────────────────────────────────
# Each BC is a single zone assignment; `BoundaryConditions` holds a list per
# kind. This generalises across CFD modes — a wing test uses inlet+outlet+
# walls+symmetry, a full-car run uses inlet+rotating-wheels+slip-walls+ground,
# both share the same shape and journal-rendering loop.


class VelocityInletBC(BaseModel):
    """A velocity inlet. Defaults match the FSAE SOP freestream (15.65 m/s).

    `turbulent_intensity_pct` is in percent (Fluent TUI takes the raw "5"
    not "0.05") to mirror the working CFD-specialist script.
    """
    zone_name: str = "inlet"
    velocity: float = 15.65
    turbulent_intensity_pct: float = 5.0
    turbulent_viscosity_ratio: float = 10.0


class PressureOutletBC(BaseModel):
    zone_name: str = "outlet"
    gauge_pressure: float = 0.0


class TranslatingWallBC(BaseModel):
    """No-slip wall translating at a constant velocity (e.g. moving ground)."""
    zone_name: str
    velocity_mps: float = 15.65
    # SOP ground motion direction: -x.
    direction_x: float = -1.0
    direction_y: float = 0.0
    direction_z: float = 0.0


class RotatingWallBC(BaseModel):
    """Rotating wall — used for wheels in the full-car workflow.

    Each wheel carries its own pivot origin so the front- and rear-tire
    rotations are placed correctly. Kevin reference: 77 rad/s about +y.
    """
    zone_name: str
    omega_rad_s: float = 77.0
    origin_x: float = 0.0
    origin_y: float = 0.0
    origin_z: float = 0.0
    axis_x: float = 0.0
    axis_y: float = 1.0
    axis_z: float = 0.0


class SlipWallBC(BaseModel):
    """Specified-shear wall (zero shear stress) — i.e. a slip wall.

    Used for tunnel side/top walls and contact patches in the full-car SOP,
    where the wall is geometrically present but should not impart shear on
    the flow.
    """
    zone_name: str


class StationaryWallBC(BaseModel):
    """No-slip stationary wall (Fluent's default wall behaviour).

    Listing a zone here just records intent / forces zone-type=wall; you
    do not normally need to enumerate the car body here because Fluent
    types unlabelled face zones as walls automatically.
    """
    zone_name: str


class SymmetryPlaneBC(BaseModel):
    zone_name: str


class BoundaryConditions(BaseModel):
    """Typed lists of BCs. Empty lists are skipped by the solver journal.

    Per-mode presets live in ``apply_cfd_mode_defaults`` below.
    """
    velocity_inlets: list[VelocityInletBC] = Field(default_factory=list)
    pressure_outlets: list[PressureOutletBC] = Field(default_factory=list)
    translating_walls: list[TranslatingWallBC] = Field(default_factory=list)
    rotating_walls: list[RotatingWallBC] = Field(default_factory=list)
    slip_walls: list[SlipWallBC] = Field(default_factory=list)
    stationary_walls: list[StationaryWallBC] = Field(default_factory=list)
    symmetry_planes: list[SymmetryPlaneBC] = Field(default_factory=list)


class SolutionMethods(BaseModel):
    scheme: str = "Coupled"
    gradient: str = "least-squares-cell-based"
    pressure: str = "second-order"
    momentum: str = "second-order-upwind"
    turbulent_kinetic_energy: str = "second-order-upwind"
    specific_dissipation_rate: str = "second-order-upwind"


class ReferenceValues(BaseModel):
    """Physics reference values used by the solver.

    Defaults from Kevin Full Car reference:
      area 1.2 m², length 2.8 m, velocity 15.65 m/s.
    """

    area_m2: float = 1.2
    length_m: float = 2.8
    velocity_mps: float = 15.65


class ConvergenceConfig(BaseModel):
    residual_target: float = 1e-4
    # SOP individual part = 300 iters; full-car specialist script = 750.
    # apply_cfd_mode_defaults() bumps this per mode.
    max_iterations: int = 300
    force_monitor_window: int = 100
    force_monitor_tolerance: float = 0.001


class DataExportConfig(BaseModel):
    forces_csv: bool = True
    residuals_csv: bool = True
    case_data: bool = True
    surface_data: list[str] = ["pressure", "wall-shear"]


class SolverConfig(BaseModel):
    general: GeneralSolverConfig = Field(default_factory=GeneralSolverConfig)
    turbulence: TurbulenceConfig = Field(default_factory=TurbulenceConfig)
    boundary_conditions: BoundaryConditions = Field(default_factory=BoundaryConditions)
    solution_methods: SolutionMethods = Field(default_factory=SolutionMethods)
    convergence: ConvergenceConfig = Field(default_factory=ConvergenceConfig)
    data_export: DataExportConfig = Field(default_factory=DataExportConfig)
    reference_values: ReferenceValues = Field(default_factory=ReferenceValues)
    # "hybrid" → /solve/init/hyb-init (one-step; matches specialist script)
    # "hybrid-absolute" → set absolute reference frame, then hyb-initialize
    initialization: str = "hybrid"


# ── Per-mode SOP defaults ────────────────────────────────────────────────


def apply_cfd_mode_defaults(mode: str, sc: "SolverConfig") -> "SolverConfig":
    """Fill in BCs / iterations / reference values that the SOP fixes per mode.

    The preset *values* now come from ``app/profiles/profiles.yaml`` (the single
    source of truth) via ``resolve_profile(mode)``; this function keeps only the
    *application logic*, which is deliberately conservative:

    - BoundaryConditions are filled **only if all BC lists are empty**, so the
      wizard can call this on every mode-change as a "load preset" without
      clobbering a user who has already customised a BC list.
    - The reference area and iteration count are bumped only when they are still
      at a recognised default, for the same non-clobbering reason. The exact
      conditions mirror the previous hardcoded behaviour byte-for-byte.

    Unknown modes leave the config untouched (forward-compatible).
    """
    try:
        profile = resolve_profile(mode)
    except UnknownProfileError:
        return sc

    bc = sc.boundary_conditions
    is_empty = not any([
        bc.velocity_inlets, bc.pressure_outlets, bc.translating_walls,
        bc.rotating_walls, bc.slip_walls, bc.stationary_walls, bc.symmetry_planes,
    ])
    if is_empty and profile.get("boundary_conditions"):
        # Pydantic coerces the nested dicts into the typed BC models.
        sc.boundary_conditions = BoundaryConditions(**profile["boundary_conditions"])

    target_area = profile.get("reference_values", {}).get("area_m2")
    target_iters = profile.get("convergence", {}).get("max_iterations")

    if mode == "full_car":
        # Override the default 1.2 m² with the full-car reference area.
        if target_area is not None and sc.reference_values.area_m2 == 1.2:
            sc.reference_values.area_m2 = target_area
        # Bump from a component-style iteration count to the full-car value.
        if target_iters is not None and sc.convergence.max_iterations in (300, 3000):
            sc.convergence.max_iterations = target_iters
    elif mode == "individual_part":
        # Drop a full-car iteration count back to the component default.
        if target_iters is not None and sc.convergence.max_iterations == 750:
            sc.convergence.max_iterations = target_iters

    return sc


# ── SLURM Configuration ──────────────────────────────────────────────────


class SlurmConfig(BaseModel):
    nodes: int = 1
    cores_per_node: int = 128
    memory_gb: int = 243
    walltime_hours: int = 24
    partition: str = "normal_q"
    account: str = "your_slurm_account"
    job_name: str = "autoansys_cfd"


# ── Top-level Job Schemas ────────────────────────────────────────────────


class JobCreate(BaseModel):
    geometry_id: uuid.UUID
    name: str
    group_id: uuid.UUID | None = None
    # SOP mode: drives defaults (iterations, wheel BCs, local-sizing categories).
    cfd_mode: str = "individual_part"  # "individual_part" | "full_car"
    # Either reference an existing completed Mesh (split workflow) OR provide
    # a mesh_config to auto-create one (mesh-reuse via config hash). Exactly
    # one of these should be set; if both are null we fall back to legacy
    # combined-mode (single journal does mesh + solve).
    mesh_id: uuid.UUID | None = None
    mesh_config: MeshConfig = Field(default_factory=MeshConfig)
    solver_config: SolverConfig = Field(default_factory=SolverConfig)
    slurm_config: SlurmConfig = Field(default_factory=SlurmConfig)


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    geometry_id: uuid.UUID
    name: str
    status: str
    config: dict | None
    slurm_job_id: str | None
    submitted_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    cluster_workspace: str | None
    group_id: uuid.UUID | None = None
    group_name: str | None = None
    owner_name: str | None = None
    mesh_id: uuid.UUID | None = None
    # Compact mesh info (name, status, cell_count) — populated by the API layer.
    mesh: dict | None = None
    created_at: datetime


class JobStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    slurm_job_id: str | None
    started_at: datetime | None
    completed_at: datetime | None


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int


class ForceReport(BaseModel):
    iteration: int
    cd: float
    cl: float
    cm: float


class ResidualData(BaseModel):
    iteration: int
    continuity: float
    x_velocity: float
    y_velocity: float
    z_velocity: float
    k: float
    omega: float


class ResultFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    filename: str
    file_type: str
    s3_key: str
    file_size: int
    created_at: datetime


# ── Parametric Sweep ────────────────────────────────────────────────────


class SweepParameter(BaseModel):
    """Defines a single parameter to sweep over."""
    path: list[str]  # e.g. ["solver", "boundary_conditions", "inlet", "velocity"]
    values: list[float | int | str]  # e.g. [15, 20, 25, 30]


class SweepCreate(BaseModel):
    """Create a parametric sweep: one base config + parameter variations."""
    geometry_id: uuid.UUID
    base_name: str  # e.g. "Wing Sweep"
    group_id: uuid.UUID | None = None
    cfd_mode: str = "individual_part"  # "individual_part" | "full_car"
    mesh_config: MeshConfig = Field(default_factory=MeshConfig)
    solver_config: SolverConfig = Field(default_factory=SolverConfig)
    slurm_config: SlurmConfig = Field(default_factory=SlurmConfig)
    sweep_param: SweepParameter
    auto_submit: bool = False  # If true, submit all jobs after creation


class SweepResponse(BaseModel):
    jobs: list[JobResponse]
    sweep_param: SweepParameter
