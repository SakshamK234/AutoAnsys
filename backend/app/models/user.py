"""User ORM model."""

import enum
import uuid
from datetime import datetime, timezone

def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

from sqlalchemy import String, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    guest = "guest"
    member = "member"
    aero_lead = "aero_lead"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", create_constraint=True),
        default=UserRole.member,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        default=_utcnow, nullable=False
    )

    # Relationships
    geometries: Mapped[list["Geometry"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    templates: Mapped[list["SimulationTemplate"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    fea_jobs: Mapped[list["FEAJob"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
