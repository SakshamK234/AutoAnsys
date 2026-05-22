"""add meshes table, mesh_status enum, jobs.mesh_id column

Revision ID: 005
Revises: 004
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# create_type=False — we create/drop the PG enum explicitly via .create()/.drop()
# with checkfirst so the migration is idempotent and the table DDL doesn't
# re-emit CREATE TYPE (which would fail with DuplicateObjectError on retries).
MESH_STATUS = postgresql.ENUM(
    "draft",
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
    name="mesh_status",
    create_type=False,
)


def upgrade() -> None:
    # Create the enum exactly once; checkfirst makes reruns safe.
    postgresql.ENUM(
        "draft",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        name="mesh_status",
    ).create(op.get_bind(), checkfirst=True)

    op.create_table(
        "meshes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "geometry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geometries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "status",
            MESH_STATUS,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("config", postgresql.JSON, nullable=True),
        sa.Column("config_hash", sa.String(64), nullable=False),
        sa.Column("cell_count", sa.Integer, nullable=True),
        sa.Column("meshing_minutes", sa.Float, nullable=True),
        sa.Column("case_file_s3_key", sa.Text, nullable=True),
        sa.Column("slurm_job_id", sa.String(64), nullable=True),
        sa.Column("submitted_at", sa.DateTime, nullable=True),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("cluster_workspace", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_meshes_status", "meshes", ["status"])
    op.create_index("ix_meshes_config_hash", "meshes", ["config_hash"])

    op.add_column(
        "jobs",
        sa.Column(
            "mesh_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("meshes.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.create_index("ix_jobs_mesh_id", "jobs", ["mesh_id"])


def downgrade() -> None:
    op.drop_index("ix_jobs_mesh_id", table_name="jobs")
    op.drop_column("jobs", "mesh_id")
    op.drop_index("ix_meshes_config_hash", table_name="meshes")
    op.drop_index("ix_meshes_status", table_name="meshes")
    op.drop_table("meshes")
    MESH_STATUS.drop(op.get_bind(), checkfirst=True)
