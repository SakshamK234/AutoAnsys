"""Mesh API schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.job import MeshConfig, SlurmConfig


class MeshCreate(BaseModel):
    geometry_id: uuid.UUID
    name: str
    group_id: uuid.UUID | None = None
    cfd_mode: str = "individual_part"  # drives Fluent defaults inside the template
    mesh_config: MeshConfig = Field(default_factory=MeshConfig)
    slurm_config: SlurmConfig = Field(default_factory=SlurmConfig)


class MeshResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    geometry_id: uuid.UUID
    group_id: uuid.UUID | None
    name: str
    status: str
    config: dict | None
    config_hash: str
    cell_count: int | None
    meshing_minutes: float | None
    case_file_s3_key: str | None
    slurm_job_id: str | None
    submitted_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    cluster_workspace: str | None
    created_at: datetime

    # Read-only enrichments (populated by the API layer, not the ORM).
    geometry_name: str | None = None
    group_name: str | None = None
    owner_name: str | None = None
    jobs_using_count: int | None = None


class MeshSummary(BaseModel):
    """Compact mesh record embedded in JobResponse."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: str
    cell_count: int | None = None
    meshing_minutes: float | None = None


class MeshStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    slurm_job_id: str | None
    started_at: datetime | None
    completed_at: datetime | None
    cell_count: int | None = None


class MeshListResponse(BaseModel):
    items: list[MeshResponse]
    total: int
