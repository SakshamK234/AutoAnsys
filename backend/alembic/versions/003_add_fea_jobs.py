"""add fea_jobs table

Revision ID: 003
Revises: 002
Create Date: 2026-04-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fea_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("slurm_job_id", sa.String(64), nullable=True),
        sa.Column("mesh_file_id", sa.String(512), nullable=False),
        sa.Column("mesh_file_name", sa.String(512), nullable=True),
        sa.Column("material_json", postgresql.JSON(), nullable=False),
        sa.Column("constraints_json", postgresql.JSON(), nullable=False),
        sa.Column("loads_json", postgresql.JSON(), nullable=False),
        sa.Column("arc_settings_json", postgresql.JSON(), nullable=False),
        sa.Column("summary_json", postgresql.JSON(), nullable=True),
        sa.Column("output_files_json", postgresql.JSON(), nullable=True),
        sa.Column("slurm_script", sa.Text(), nullable=True),
        sa.Column("cluster_workspace", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_fea_jobs_status", "fea_jobs", ["status"])
    op.create_index("ix_fea_jobs_user_id", "fea_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_fea_jobs_user_id", table_name="fea_jobs")
    op.drop_index("ix_fea_jobs_status", table_name="fea_jobs")
    op.drop_table("fea_jobs")
