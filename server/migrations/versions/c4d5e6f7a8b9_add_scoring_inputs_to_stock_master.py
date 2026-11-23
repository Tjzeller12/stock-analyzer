"""Add scoring inputs and raw provider payloads to stock_master

Revision ID: c4d5e6f7a8b9
Revises: a9b0c1d2e3f4
Create Date: 2026-11-10 12:00:00.000000

eps_ttm and ebitda let scoring tell a loss-maker's missing P/E, or a negative
EBITDA's EV/EBITDA, from a cheap stock. overview_raw and balance_sheet_history
keep payloads the ingest already downloads, so later metrics need no new calls.
See planning/14-radar-scoring-refinement/phase-1-design.md §3.1. Additive only.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c4d5e6f7a8b9'
down_revision = 'a9b0c1d2e3f4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('stock_master', schema=None) as batch_op:
        batch_op.add_column(sa.Column('eps_ttm', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('ebitda', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('overview_raw', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('balance_sheet_history', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('stock_master', schema=None) as batch_op:
        batch_op.drop_column('balance_sheet_history')
        batch_op.drop_column('overview_raw')
        batch_op.drop_column('ebitda')
        batch_op.drop_column('eps_ttm')
