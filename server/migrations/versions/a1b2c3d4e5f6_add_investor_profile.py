"""Add investor_profile table

Revision ID: a1b2c3d4e5f6
Revises: 88384e70f080
Create Date: 2026-06-13 22:30:00.000000

Creates the 1:1 InvestorProfile table that backs the personalization & onboarding
feature. No data backfill is required: existing users simply have no profile row
until they complete onboarding (GET /profile/investor returns a completed=False shell).
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '88384e70f080'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'investor_profile',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(length=32), nullable=False),
        sa.Column('risk_tolerance_score', sa.Float(), nullable=True),
        sa.Column('risk_tag', sa.String(length=20), nullable=True),
        sa.Column('time_horizon_years', sa.Integer(), nullable=True),
        sa.Column('horizon_tag', sa.String(length=20), nullable=True),
        sa.Column('budget', sa.Float(), nullable=True),
        sa.Column('preferred_sectors', sa.JSON(), nullable=True),
        sa.Column('raw_answers', sa.JSON(), nullable=True),
        sa.Column('onboarding_completed', sa.Boolean(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )


def downgrade():
    op.drop_table('investor_profile')
