"""Widen general_stock_news URL/summary columns to Text

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-09-07 18:30:00.000000

The model already uses Text for link / image_link / summary and String(500)
for title, but older DBs created those as VARCHAR(255). Alpha Vantage
summaries and CDN image URLs regularly exceed 255 chars, which raises
DataError (sqlalchemy 9h9h) and aborts /data/news before CORS headers
are written.
"""
from alembic import op
import sqlalchemy as sa


revision = 'f8a9b0c1d2e3'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('general_stock_news', schema=None) as batch_op:
        batch_op.alter_column(
            'title',
            existing_type=sa.String(length=255),
            type_=sa.String(length=500),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'image_link',
            existing_type=sa.String(length=255),
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'summary',
            existing_type=sa.String(length=255),
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'link',
            existing_type=sa.String(length=255),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table('general_stock_news', schema=None) as batch_op:
        batch_op.alter_column(
            'link',
            existing_type=sa.Text(),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'summary',
            existing_type=sa.Text(),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'image_link',
            existing_type=sa.Text(),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
        batch_op.alter_column(
            'title',
            existing_type=sa.String(length=500),
            type_=sa.String(length=255),
            existing_nullable=True,
        )
