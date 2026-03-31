"""Job ORM model."""

import enum
import uuid
from datetime import datetime, timezone

from app.models.user import _utcnow

from sqlalchemy import ForeignKey, String, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobStatus(str, enum.Enum):
    draft = "draft"
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    geometry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("geometries.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, name="job_status", create_constraint=True),
        default=JobStatus.draft,
        nullable=False,
        index=True,
    )
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    slurm_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    cluster_workspace: Mapped[str | None] = mapped_column(Text, nullable=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        default=_utcnow, nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="jobs")  # noqa: F821
    geometry: Mapped["Geometry"] = relationship(back_populates="jobs")  # noqa: F821
    group: Mapped["Group | None"] = relationship(back_populates="jobs")  # noqa: F821
    result_files: Mapped[list["ResultFile"]] = relationship(  # noqa: F821
        back_populates="job", cascade="all, delete-orphan"
    )
