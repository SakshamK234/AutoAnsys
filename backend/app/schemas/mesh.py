"""Mesh API schemas."""

import uuid
from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.job import MeshConfig, SlurmConfig
from app.utils import validation as vld

# Absolute HPC directory: plain path segments only — no "..", no shell
# metacharacters. "<username>" is allowed as a literal substitution token.
_OUTPUT_PATH_RE = re.compile(r"^/(?:[A-Za-z0-9_.\-]+|<username>)(?:/(?:[A-Za-z0-9_.\-]+|<username>))*/?$")


class MeshCreate(BaseModel):
    geometry_id: uuid.UUID
    name: str
    group_id: uuid.UUID | None = None
    cfd_mode: str = "individual_part"  # drives Fluent defaults inside the template
    mesh_config: MeshConfig = Field(default_factory=MeshConfig)
    slurm_config: SlurmConfig = Field(default_factory=SlurmConfig)
    # Destination directory on the HPC where mesh.cas.h5 should be copied
    # after the SLURM job completes. The literal token "<username>" is
    # substituted with the configured CLUSTER_USER at submit time.
    output_path: str | None = None

    @field_validator("cfd_mode")
    @classmethod
    def _v_cfd_mode(cls, v: str) -> str:
        return vld.one_of(v, ("individual_part", "full_car"), field="cfd_mode")

    @field_validator("output_path")
    @classmethod
    def _v_output_path(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not _OUTPUT_PATH_RE.match(v) or ".." in v:
            raise ValueError(
                "output_path must be an absolute path of plain segments "
                "(letters, digits, '_', '.', '-'; no '..')"
            )
        return v


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
    error_message: str | None = None
    progress: dict | None = None
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
    error_message: str | None = None
    progress: dict | None = None


class MeshListResponse(BaseModel):
    items: list[MeshResponse]
    total: int
