"""Merge brokerage-import and OAuth/usage alembic heads

Revision ID: e7f8a9b0c1d2
Revises: b2c3d4e5f6a7, d31b24c81152
Create Date: 2026-08-27 10:40:00.000000

After merging origin/dev into brokerage-import there were two heads:
  a1b2c3d4e5f6
    ├── 3252ba729ffc → d31b24c81152  (google_id, tier, alphabot usage)
    └── b2c3d4e5f6a7                 (brokerage tables)

This empty merge revision unifies them.
"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


revision = 'e7f8a9b0c1d2'
down_revision = ('b2c3d4e5f6a7', 'd31b24c81152')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
