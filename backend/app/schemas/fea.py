"""FEA request and response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Material ──────────────────────────────────────────────────────────────


class FEAMaterial(BaseModel):
    preset: str = "custom"
    youngs_modulus: float = Field(..., gt=0, description="Pa")
    poissons_ratio: float = Field(..., gt=0, lt=0.5)
    density: float = Field(..., gt=0, description="kg/m³")
    yield_strength: float | None = Field(None, ge=0, description="Pa — optional")


# ── Constraints ───────────────────────────────────────────────────────────


class DisplacementValue(BaseModel):
    x: float | None = None
    y: float | None = None
    z: float | None = None


class FEAConstraint(BaseModel):
    type: str  # fixed | pinned | roller | symmetry | displacement
    face_ids: list[str]
    axis: str | None = None  # roller only: X, Y, Z
    plane: str | None = None  # symmetry only: XY, YZ, XZ
    displacement: DisplacementValue | None = None


# ── Loads ─────────────────────────────────────────────────────────────────


class Direction(BaseModel):
    x: float = 0
    y: float = 0
    z: float = 0


class FEALoad(BaseModel):
    type: str  # force | pressure | gravity | displacement
    face_ids: list[str] | None = None
    magnitude: float | None = None
    direction: Direction | None = None
    displacement: DisplacementValue | None = None
    g: float | None = None  # gravity only


# ── ARC Settings ──────────────────────────────────────────────────────────


class FEAArcSettings(BaseModel):
    job_name: str | None = None
    partition: str = "standard"
    nodes: int = Field(1, ge=1)
    tasks_per_node: int = Field(8, ge=1)
    walltime: str = "01:00:00"


# ── Submit Payload ────────────────────────────────────────────────────────


class FEASubmitPayload(BaseModel):
    job_name: str = Field(..., min_length=1, max_length=255)
    mesh_file_id: str
    mesh_file_name: str | None = None
    material: FEAMaterial
    constraints: list[FEAConstraint] = Field(..., min_length=1)
    loads: list[FEALoad] = Field(..., min_length=1)
    arc: FEAArcSettings = Field(default_factory=FEAArcSettings)


# ── Response Schemas ──────────────────────────────────────────────────────


class FEAJobSummary(BaseModel):
    max_displacement_mm: float
    max_von_mises_stress_mpa: float
    max_principal_stress_mpa: float
    min_principal_stress_mpa: float
    max_reaction_force_n: float
    yielded: bool | None = None
    yield_strength_mpa: float | None = None
    safety_factor: float | None = None


class FEAOutputFile(BaseModel):
    name: str
    url: str


class FEAJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    job_name: str
    status: str
    slurm_job_id: str | None = None
    mesh_file_id: str
    mesh_file_name: str | None = None
    material_json: dict | None = None
    constraints_json: list | None = None
    loads_json: list | None = None
    arc_settings_json: dict | None = None
    summary_json: dict | None = None
    output_files_json: list | None = None
    cluster_workspace: str | None = None
    created_at: datetime
    updated_at: datetime


class FEAJobListResponse(BaseModel):
    items: list[FEAJobResponse]
    total: int


class FEAStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    slurm_job_id: str | None = None
    summary_json: dict | None = None
    output_files_json: list | None = None
