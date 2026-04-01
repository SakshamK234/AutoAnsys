"""Job request and response schemas with nested config models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Mesh Configuration ────────────────────────────────────────────────────


class LocalSizingRegion(BaseModel):
    """A single body-of-influence or face sizing region."""

    name: str
    type: str = "body_of_influence"  # body_of_influence | face_sizing
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
    min_size: float = 0.002
    max_size: float = 0.1
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


class MeshConfig(BaseModel):
    local_sizing: list[LocalSizingRegion] = []
    surface_mesh: SurfaceMeshConfig = Field(default_factory=SurfaceMeshConfig)
    volume_mesh: VolumeMeshConfig = Field(default_factory=VolumeMeshConfig)
    wind_tunnel: WindTunnelConfig = Field(default_factory=WindTunnelConfig)
    geometry_unit: str = "m"


# ── Solver Configuration ─────────────────────────────────────────────────


class GeneralSolverConfig(BaseModel):
    solver_type: str = "pressure-based"
    time: str = "steady"
    velocity_formulation: str = "absolute"


class TurbulenceConfig(BaseModel):
    model: str = "k-omega-sst"
    near_wall_treatment: str = "auto"


class InletBC(BaseModel):
    zone_name: str = "inlet"
    velocity: float = 20.0
    turbulent_intensity: float = 0.01
    turbulent_viscosity_ratio: float = 10.0


class OutletBC(BaseModel):
    zone_name: str = "outlet"
    gauge_pressure: float = 0.0


class GroundBC(BaseModel):
    zone_name: str = "ground"
    type: str = "moving-wall"
    velocity: float = 20.0


class SymmetryBC(BaseModel):
    zone_names: list[str] = ["symmetry-top", "symmetry-side-1", "symmetry-side-2"]
    type: str = "symmetry"


class BoundaryConditions(BaseModel):
    inlet: InletBC = Field(default_factory=InletBC)
    outlet: OutletBC = Field(default_factory=OutletBC)
    ground: GroundBC = Field(default_factory=GroundBC)
    symmetry: SymmetryBC = Field(default_factory=SymmetryBC)


class SolutionMethods(BaseModel):
    scheme: str = "Coupled"
    gradient: str = "least-squares-cell-based"
    pressure: str = "second-order"
    momentum: str = "second-order-upwind"
    turbulent_kinetic_energy: str = "second-order-upwind"
    specific_dissipation_rate: str = "second-order-upwind"


class ConvergenceConfig(BaseModel):
    residual_target: float = 1e-4
    max_iterations: int = 2000
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


# ── SLURM Configuration ──────────────────────────────────────────────────


class SlurmConfig(BaseModel):
    nodes: int = 1
    cores_per_node: int = 128
    memory_gb: int = 243
    walltime_hours: int = 24
    partition: str = "normal_q"
    account: str = "fsae"
    job_name: str = "autoansys_cfd"


# ── Top-level Job Schemas ────────────────────────────────────────────────


class JobCreate(BaseModel):
    geometry_id: uuid.UUID
    name: str
    group_id: uuid.UUID | None = None
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
