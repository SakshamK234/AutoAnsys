"""FEA Job ORM model."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import _utcnow


class FEAJobStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class FEAJob(Base):
    __tablename__ = "fea_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default=FEAJobStatus.pending.value, nullable=False, index=True
    )
    slurm_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mesh_file_id: Mapped[str] = mapped_column(String(512), nullable=False)
    mesh_file_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    material_json: Mapped[dict | None] = mapped_column(JSON, nullable=False)
    constraints_json: Mapped[list | None] = mapped_column(JSON, nullable=False)
    loads_json: Mapped[list | None] = mapped_column(JSON, nullable=False)
    arc_settings_json: Mapped[dict | None] = mapped_column(JSON, nullable=False)
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_files_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    slurm_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    cluster_workspace: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=_utcnow, onupdate=_utcnow, nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="fea_jobs")  # noqa: F821
