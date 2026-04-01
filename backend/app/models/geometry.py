"""Geometry ORM model."""

import uuid
from datetime import datetime, timezone

from app.models.user import _utcnow

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Geometry(Base):
    __tablename__ = "geometries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_name: Mapped[str] = mapped_column(String(512), nullable=False)
    component_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=_utcnow, nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="geometries")  # noqa: F821
    jobs: Mapped[list["Job"]] = relationship(  # noqa: F821
        back_populates="geometry", cascade="all, delete-orphan"
    )
