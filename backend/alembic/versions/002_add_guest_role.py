"""add guest to user_role enum

Revision ID: 002
Revises: 001
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum type.
    # A full migration would need to recreate the type; left as a no-op
    # since guest rows can simply be deleted manually if needed.
    pass
