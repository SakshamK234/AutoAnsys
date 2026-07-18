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
    # Optional Fluent sizing-control extras (specialist full-car journal):
    # emitted only when set, so existing configs render unchanged.
    cells_per_gap: int | None = None
    curvature_normal_angle: float | None = None


class RefinementRegionBox(BaseModel):
    """A 'Create Local Refinement Regions' box (Watertight workflow task).

    From the specialist full-car journal. Two creation flavours:
      - ``labels`` set → box sized 'Ratio relative to geometry size' around the
        selected face labels' bounding box (tire-wake boxes). Per-side ratios
        default to the specialist's 0.1; the wake side is stretched via the
        matching ratio (e.g. ``x_min_ratio: 1.5``).
      - ``labels`` empty → absolute-coordinate box in geometry units
        ('Directly specify coordinates').
    ``max_size`` is the BOI max cell size in geometry units.
    """

    name: str
    max_size: float
    labels: list[str] = []
    # Relative mode: per-side expansion ratios.
    x_min_ratio: float = 0.1
    x_max_ratio: float = 0.1
    y_min_ratio: float = 0.1
    y_max_ratio: float = 0.1
    z_min_ratio: float = 0.1
    z_max_ratio: float = 0.1
    # Absolute mode: box coordinates (geometry units).
    x_min: float | None = None
    x_max: float | None = None
    y_min: float | None = None
    y_max: float | None = None
    z_min: float | None = None
    z_max: float | None = None


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
    # Boundary-layer params. num_layers is wired into Add Boundary Layers (M5).
    #
    # first_layer_height_mm (F9): explicit first prism-cell height in mm for a
    # wall-resolved y+ ≈ 1 target with k-ω SST (~0.02–0.05 mm at 15.65 m/s for
    # FSAE-scale parts). OPT-IN: when None (default) the journal keeps the SOP
    # last-ratio defaults exactly as the team has run them; when set, the
    # Add Boundary Layers task gets 'FirstHeight'. [needs-cluster] verify the
    # 2025R1 arg is honoured with OffsetMethodType='last-ratio'.
    first_layer_height_mm: float | None = None
    # Deprecated: never reached Fluent (AUDIT C6) and its unit was ambiguous.
    # Kept so stored configs still validate; use first_layer_height_mm instead.
    first_layer_height: float = 5e-5
    num_layers: int = 15
    bl_growth_rate: float = 1.2
    # Grow prisms only on these face labels (specialist full-car journal:
    # FaceScope 'selected-labels' + BlLabelList). Empty → default wall scope.
    prism_labels: list[str] = []
    # Volume fill: "default" keeps the Watertight default (validated on the
    # wing); "poly-hexcore" matches the specialist full-car journal, with
    # hex_max_cell_length (geometry units) → VolumeFillControls.HexMaxCellLength.
    fill: str = "default"
    hex_max_cell_length: float | None = None


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
    # Improve Volume Mesh insertion after Generate Volume Mesh. Separate from
    # auto_improve (surface) because the specialist full-car journal improves
    # the surface mesh but not the volume mesh.
    improve_volume: bool = True
    # Improve Surface Mesh SQMinSize; None → surface_mesh.min_size. The
    # specialist full-car journal uses 0.25 (the trailing-edge face size).
    sq_min_size: float | None = None


class ScopedSizing(BaseModel):
    """FT wrap curvature+proximity controls scoped to the CAR objects only, ON
    TOP of the workflow default control set (fc9/fc10). Refines the wrap where
    it matters without the tunnel shell. Never use CreationMethod 'Custom' —
    it REPLACES defaults and degenerates the wrap (probes 6377338+)."""

    min_size: float = 2.0
    max_size: float = 16.0
    growth_rate: float = 1.2
    curvature_normal_angle: float = 18.0
    cells_per_gap: int = 3


class CarveDomain(BaseModel):
    """Coordinate slabs (in SOLVER units — metres) that carve non-car surfaces
    (ground / tunnel top / inlet-outlet-side rim strips) out of the fused
    'car-shell' zone after the wrap (fc26d–fc28). Ground fuses with the wheels
    through tangential contact patches, so no angle method can separate it —
    a thin z-slab register + sep-face-zone-mark does.

    Defaults are the V0.4-stepFC wrapped domain (fc28). A DIFFERENT car needs
    its own bounds (read them from the mesh's MESH ZONE LIST / domain extents).
    Margins are the slab thickness at each face."""

    x_min: float = -12.454
    x_max: float = 3.941
    y_min: float = 0.0
    y_max: float = 3.209
    z_min: float = 0.0
    z_max: float = 3.726
    # How far in from the GROUND plane (z-min) the carve slab reaches (m). The
    # ground fuses with the wheel contact patches, so keep this thin to avoid
    # eating wheel geometry (fc28: 6 mm).
    margin: float = 0.006
    # How far in from each tunnel WALL (top / inlet / outlet / far side) the rim
    # carve slabs reach (m), to peel rim strips that stuck to car-shell near the
    # walls (fc28: 40 mm). y-min is the symmetry plane and gets no slab.
    rim_margin: float = 0.04
    # Tiny over-reach past each plane so boundary faces are surely enclosed (m).
    epsilon: float = 0.001


class MeshConfig(BaseModel):
    local_sizing: list[LocalSizingRegion] = []
    # Watertight 'Create Local Refinement Regions' boxes (specialist full-car
    # journal): tire-wake boxes relative to wheel labels + absolute nearfield.
    refinement_regions: list[RefinementRegionBox] = []
    # ── FT wrap full-car recipe (fc13→fc28, config-driven) ────────────────
    # CAD objects to delete after import — the V0.4 export packs a redundant
    # 'bounding_box' body that wraps into a sealed crate around the car (fc11).
    delete_bodies: list[str] = []
    # Split the fluid body's CAD shell by angle BEFORE the wrap so the tunnel
    # box faces survive as separate zones (the wrap rounds edges — fc14/fc16).
    prewrap_shell_split: bool = False
    # CAD face-zone id of the fluid shell to split (deterministic per import;
    # 6 for the V0.4 export, fc11/fc28). A dimension assert guards it.
    prewrap_shell_zone: int = 6
    # Scoped curvature+proximity sizing on the car objects (fc10). None → the
    # bare workflow defaults (structurally valid but ~89k cells, too coarse).
    scoped_sizing: ScopedSizing | None = None
    # Run the geometric boundary classifier after the wrap: split the tunnel
    # shell, name inlet/outlet/symmetry/farfield-* by position, merge car
    # zones → 'car', rename the fused mega-zone 'car-shell' (fc16/fc28).
    classify_boundaries: bool = False
    # Carve ground/top/rim slabs out of car-shell (fc28). Requires
    # classify_boundaries. None → no carve (forces would include tunnel walls).
    carve_domain: CarveDomain | None = None
    surface_mesh: SurfaceMeshConfig = Field(default_factory=SurfaceMeshConfig)
    volume_mesh: VolumeMeshConfig = Field(default_factory=VolumeMeshConfig)
    wind_tunnel: WindTunnelConfig = Field(default_factory=WindTunnelConfig)
    enclosure: EnclosureConfig | None = Field(default_factory=EnclosureConfig)
    mesh_quality: MeshQuality = Field(default_factory=MeshQuality)
    geometry_unit: str = "mm"
    # Mesh workflow (AUDIT C11): "watertight" for clean components, "fault-tolerant"
    # (surface-wrapped) for dirty full-car assemblies. Profile-driven.
    workflow: str = "watertight"
    # When true, the pipeline builds the fluid enclosure from the part bounding box
    # (AUDIT C10, maintainer decision #3) instead of assuming the geometry already
    # contains a Discovery-built enclosure. Default false preserves the current
    # pre-enclosed-geometry workflow; set true to hand the pipeline a bare part.
    build_enclosure: bool = False
    # Face labels the user applied in Discovery to the Parasolid export.
    # Passed as Generate Surface Mesh `OriginalZones` so Fluent preserves them
    # through meshing. Matches the FSAE SOP convention exactly. None → omit
    # OriginalZones/ExecuteShareTopology entirely (specialist full-car journal
    # relies on the task defaults; its labels differ from the SOP names).
    original_zones: list[str] | None = Field(
        default_factory=lambda: [
            "inlet",
            "outlet",
            "ground",
            "symmetry",
            "walls",
        ]
    )
    # Describe Geometry setup (specialist full-car journal): "fluid-only"
    # declares 'The geometry consists of only fluid regions with no voids'
    # (the CAD models the tunnel-minus-car fluid volume directly) and pairs
    # with wall_to_internal. "default" keeps the wing-validated behaviour.
    describe_setup_type: str = "default"  # default | fluid-only
    wall_to_internal: bool = False
    # True → pin the wing-validated CadImportOptions (OneZonePer 'body',
    # feature extraction). False → set only FileName/LengthUnit and keep the
    # Import task defaults, matching the specialist full-car journal.
    pin_cad_import_options: bool = True


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

    These feed Fluent's ``/report/reference-values`` and are what make force
    *coefficients* (Cd/Cl/Cm) physical. ``density_kg_m3`` was previously never
    set (AUDIT C4), so coefficients silently used Fluent's default density.

    For a HALF model (symmetry plane on the centreline), ``area_m2`` is the
    **full** frontal area and the resulting half-model forces/coefficients are
    doubled in post-processing via ``SymmetryConfig.force_factor`` — see
    AUDIT C1/C9 and SymmetryConfig below.

    Defaults from the Kevin Full Car reference: length 2.8 m, velocity 15.65 m/s.
    """

    area_m2: float = 1.2
    length_m: float = 2.8
    velocity_mps: float = 15.65
    # Sea-level air. [needs-cluster] confirm the operating density used on ARC.
    density_kg_m3: float = 1.225


class ConvergenceConfig(BaseModel):
    residual_target: float = 1e-4
    # SOP individual part = 300 iters; full-car specialist script = 750.
    # apply_cfd_mode_defaults() bumps this per mode.
    max_iterations: int = 300
    # Force-coefficient plateau convergence (AUDIT C5): stop once cd/cl change by
    # less than `force_monitor_tolerance` over `force_monitor_window` iterations.
    # These were defined but never emitted before; M2 wires them into the journal.
    force_monitor_window: int = 100
    force_monitor_tolerance: float = 0.001
    use_force_convergence: bool = True


class SymmetryConfig(BaseModel):
    """Half-model symmetry handling (AUDIT C1/C9 — the classic silent bug).

    When a centreline symmetry plane halves the body, Fluent integrates forces
    over the half model only. With ``reference_values.area_m2`` set to the FULL
    frontal area, both the half-model force (N) and the half-model coefficient
    come out at half the true value, so post-processing multiplies every
    reported force/coefficient by ``force_factor`` (2.0 for a half model).

    The factor is applied in post-processing, not the journal, because Fluent
    cannot scale a report definition. ``apply_cfd_mode_defaults`` keeps it
    consistent with whether a symmetry plane is present (see correctness guard).
    """

    half_model: bool = False
    force_factor: float = 1.0


class ReportingConfig(BaseModel):
    """Force/moment report scope and outputs (AUDIT C2/C3).

    ``body_wall_pattern`` scopes force integration to the body wall zone(s)
    instead of the previous ``*`` (which wrongly included the ground and tunnel
    walls). Both force (N) and coefficient (Cd/Cl/Cm) reports are emitted so the
    team gets dimensional downforce/drag AND normalised coefficients.
    """

    # [needs-cluster F3] confirm the actual body wall zone name/pattern on ARC.
    body_wall_pattern: str = "wall-body*"
    emit_forces_newtons: bool = True
    emit_coefficients: bool = True
    moment_center_x: float = 0.0
    moment_center_y: float = 0.0
    moment_center_z: float = 0.0


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
    symmetry: SymmetryConfig = Field(default_factory=SymmetryConfig)
    reporting: ReportingConfig = Field(default_factory=ReportingConfig)
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
    target_length = profile.get("reference_values", {}).get("length_m")
    target_iters = profile.get("convergence", {}).get("max_iterations")

    if mode == "full_car":
        # Override the default 1.2 m² with the full-car FULL frontal area (F1).
        if target_area is not None and sc.reference_values.area_m2 == 1.2:
            sc.reference_values.area_m2 = target_area
        # Override the default 2.8 m with the wheelbase reference length (F1).
        if target_length is not None and sc.reference_values.length_m == 2.8:
            sc.reference_values.length_m = target_length
        # Specialist-matched freestream (17.88 m/s): seed only while still at
        # the schema default so an explicit user velocity is never clobbered.
        target_vel = profile.get("reference_values", {}).get("velocity_mps")
        if target_vel is not None and sc.reference_values.velocity_mps == 15.65:
            sc.reference_values.velocity_mps = target_vel
        # Bump from a component-style iteration count to the full-car value.
        if target_iters is not None and sc.convergence.max_iterations in (300, 3000):
            sc.convergence.max_iterations = target_iters
    elif mode == "individual_part":
        # Drop a full-car iteration count back to the component default.
        if target_iters is not None and sc.convergence.max_iterations == 750:
            sc.convergence.max_iterations = target_iters

    # Half-model symmetry factor (AUDIT C1). Seed from the profile only while the
    # config is still at the schema default (half_model=False, force_factor=1.0),
    # so a user who set it explicitly is never clobbered.
    sym = profile.get("symmetry")
    if sym and not sc.symmetry.half_model and sc.symmetry.force_factor == 1.0:
        sc.symmetry.half_model = bool(sym.get("half_model", False))
        sc.symmetry.force_factor = float(sym.get("force_factor", 1.0))

    # Body-wall force-integration pattern (full_car classifier emits car +
    # car-shell). Seed only while still at the schema default so a user choice
    # is never clobbered.
    rep = profile.get("reporting")
    if rep and sc.reporting.body_wall_pattern == "wall-body*":
        sc.reporting.body_wall_pattern = rep.get(
            "body_wall_pattern", sc.reporting.body_wall_pattern
        )

    return sc


# ── Correctness guards (AUDIT C1/C3/C4/C9) ───────────────────────────────────


def check_solver_correctness(sc: "SolverConfig", cfd_mode: str) -> list[str]:
    """Return a list of human-readable correctness warnings for a solver config.

    Catches the classic silent mistakes: reference values unset, a symmetry plane
    present without the doubling factor (or vice-versa), full-car missing its
    moving ground / rotating wheels, and a bare component carrying wheel BCs.
    Returns an empty list when everything is consistent. Used by journal
    generation (logged) and by tests.
    """
    warnings: list[str] = []
    bc = sc.boundary_conditions
    rv = sc.reference_values

    if rv.area_m2 <= 0:
        warnings.append("reference area is <= 0; coefficients will be non-physical")
    if rv.velocity_mps <= 0:
        warnings.append("reference velocity is <= 0")
    if rv.density_kg_m3 <= 0:
        warnings.append("reference density is <= 0")

    has_symmetry = bool(bc.symmetry_planes)
    if has_symmetry and sc.symmetry.force_factor == 1.0:
        warnings.append(
            "a symmetry plane is present but symmetry.force_factor is 1.0 — "
            "half-model forces will be under-reported by ~2x (AUDIT C1)"
        )
    if sc.symmetry.force_factor != 1.0 and not has_symmetry:
        warnings.append(
            f"symmetry.force_factor is {sc.symmetry.force_factor} but no symmetry "
            "plane is defined — forces may be over-reported"
        )

    if cfd_mode == "full_car":
        if not bc.translating_walls:
            warnings.append("full_car has no moving-ground (translating) wall BC")
        if not bc.rotating_walls:
            warnings.append("full_car has no rotating-wheel BCs")
    elif cfd_mode == "individual_part":
        if bc.rotating_walls:
            warnings.append(
                "individual_part carries rotating-wheel BCs — unexpected for a bare component"
            )

    return warnings


# ── SLURM Configuration ──────────────────────────────────────────────────


class SlurmConfig(BaseModel):
    nodes: int = 1
    cores_per_node: int = 128
    memory_gb: int = 243
    walltime_hours: int = 24
    partition: str = "normal_q"
    account: str = "your_slurm_account"
    job_name: str = "autoansys_cfd"
    # Fluent parallel transport (AUDIT S1; F6: Intel MPI + InfiniBand on
    # TinkerCliffs). interconnect maps to the Fluent flag: infiniband -> -pib,
    # ethernet -> -peth, none -> (omitted).
    mpi: str = "intel"
    interconnect: str = "infiniband"


def apply_cfd_mode_slurm_defaults(mode: str, sc: "SlurmConfig") -> "SlurmConfig":
    """Seed per-profile SLURM resources (nodes / cores / mem / walltime).

    Applied only when ALL four resource fields are still at their schema default,
    i.e. the caller did not size resources themselves (API-direct / sweep clones).
    Account / partition / MPI are left untouched. Unknown modes are a no-op.
    """
    try:
        profile = resolve_profile(mode)
    except UnknownProfileError:
        return sc
    preset = profile.get("slurm")
    if not preset:
        return sc

    default = SlurmConfig()
    untouched = (
        sc.nodes == default.nodes
        and sc.cores_per_node == default.cores_per_node
        and sc.memory_gb == default.memory_gb
        and sc.walltime_hours == default.walltime_hours
    )
    if untouched:
        sc.nodes = preset.get("nodes", sc.nodes)
        sc.cores_per_node = preset.get("cores_per_node", sc.cores_per_node)
        sc.memory_gb = preset.get("memory_gb", sc.memory_gb)
        sc.walltime_hours = preset.get("walltime_hours", sc.walltime_hours)
    return sc


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge ``override`` into a copy of ``base`` (dicts only)."""
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def apply_cfd_mode_mesh_defaults(mode: str, mc: "MeshConfig") -> "MeshConfig":
    """Seed the per-profile mesh preset (workflow, sizing, refinement regions).

    A fully-default ``mc`` receives the whole profile ``mesh`` preset (deep
    merged over schema defaults) — this is how full_car picks up the
    specialist watertight recipe. A user-customised ``mc`` only gets the
    legacy workflow seeding so explicit choices are never overridden.
    Unknown modes are a no-op.
    """
    try:
        profile = resolve_profile(mode)
    except UnknownProfileError:
        return mc
    preset = profile.get("mesh") or {}
    if mc == MeshConfig():
        return MeshConfig.model_validate(_deep_merge(mc.model_dump(), preset))
    if mc.workflow == "watertight" and "workflow" in preset:
        mc.workflow = preset["workflow"]
    return mc


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
    # Coefficients (derived in post from forces + reference values, M2).
    cd: float
    cl: float
    cm: float
    # Symmetry-corrected forces in Newtons / N·m (0.0 for legacy jobs whose CSV
    # predates the M2 honest-force columns).
    drag_n: float = 0.0
    lift_n: float = 0.0
    moment_nm: float = 0.0


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
