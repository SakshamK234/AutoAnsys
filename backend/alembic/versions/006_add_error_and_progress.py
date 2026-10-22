"""add error_message + progress columns to jobs and meshes

Failure reasons (journal abort excerpts, SLURM verdicts) and live stage
progress snapshots are first-class state so the UI can explain a run without
anyone SSHing to the cluster (GUI_PLAN G1.5 / G1.6).

Revision ID: 006
Revises: 005
Create Date: 2026-10-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("progress", postgresql.JSON(), nullable=True))
    op.add_column("meshes", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("meshes", sa.Column("progress", postgresql.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("meshes", "progress")
    op.drop_column("meshes", "error_message")
    op.drop_column("jobs", "progress")
    op.drop_column("jobs", "error_message")
