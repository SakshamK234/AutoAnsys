"""Mesh ORM model.

A Mesh is a first-class artifact produced by running Fluent Watertight
meshing against a Geometry. Multiple solver Jobs can reference the same
Mesh — this lets us skip re-meshing for sweeps over solver-only params.
"""

import enum
import uuid
from datetime import datetime

from app.models.user import _utcnow

from sqlalchemy import ForeignKey, String, Text, Enum as SAEnum, Integer, Float
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MeshStatus(str, enum.Enum):
    draft = "draft"
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Mesh(Base):
    __tablename__ = "meshes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    geometry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geometries.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[MeshStatus] = mapped_column(
        SAEnum(MeshStatus, name="mesh_status", create_constraint=True),
        default=MeshStatus.draft,
        nullable=False,
        index=True,
    )
    # Full config blob: { cfd_mode, mesh: MeshConfig, slurm: SlurmConfig }.
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # sha256 of (geometry_id.bytes + canonical_json(mesh_config)). Indexed so
    # MeshService.get_or_create can reuse an existing completed mesh in O(1).
    config_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Populated on completion.
    cell_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    meshing_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    case_file_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    slurm_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    cluster_workspace: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)

    # Relationships
    owner: Mapped["User"] = relationship()  # noqa: F821
    geometry: Mapped["Geometry"] = relationship()  # noqa: F821
    group: Mapped["Group | None"] = relationship()  # noqa: F821
    jobs: Mapped[list["Job"]] = relationship(back_populates="mesh")  # noqa: F821
