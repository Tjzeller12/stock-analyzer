"""Add config and profile_risk_tag to analysis_template

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-09-09 16:20:00.000000

Stores the full radar + column view on each template so apply can restore
both table and spider, and tags seeded defaults by investor risk_tag.
"""
from alembic import op
import sqlalchemy as sa


revision = "a9b0c1d2e3f4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("analysis_template", schema=None) as batch_op:
        batch_op.add_column(sa.Column("config", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("profile_risk_tag", sa.String(length=32), nullable=True))


def downgrade():
    with op.batch_alter_table("analysis_template", schema=None) as batch_op:
        batch_op.drop_column("profile_risk_tag")
        batch_op.drop_column("config")
