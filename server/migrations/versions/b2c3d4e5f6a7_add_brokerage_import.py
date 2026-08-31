"""Add brokerage import tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 05:00:00.000000

Creates BrokerageConnection, Holding, and PerformanceSnapshot for the brokerage
portfolio import feature. No backfill: users have no connection until they link a
broker. Aggregator secrets are stored encrypted in access_token_enc.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'brokerage_connection',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('provider', sa.String(length=40), nullable=False),
        sa.Column('brokerage_name', sa.String(length=80), nullable=True),
        sa.Column('provider_user_ref', sa.String(length=120), nullable=True),
        sa.Column('access_token_enc', sa.LargeBinary(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('last_synced', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'holding',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('connection_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=12), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('avg_cost', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['connection_id'], ['brokerage_connection.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('connection_id', 'symbol', name='uq_holding_connection_symbol'),
    )

    op.create_table(
        'performance_snapshot',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('total_value', sa.Float(), nullable=True),
        sa.Column('total_cost_basis', sa.Float(), nullable=True),
        sa.Column('total_return', sa.Float(), nullable=True),
        sa.Column('total_return_pct', sa.Float(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['analysis_template.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('performance_snapshot')
    op.drop_table('holding')
    op.drop_table('brokerage_connection')
