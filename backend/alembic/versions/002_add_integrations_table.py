"""Add integrations table

Revision ID: 002
Revises: 001
Create Date: 2026-04-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create integrations table
    op.create_table(
        'integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=True),
        sa.Column('refresh_token_encrypted', sa.Text(), nullable=True),
        sa.Column('tenant_id', sa.String(255), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, default='disconnected'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_integrations_provider', 'integrations', ['provider'])
    op.create_index('ix_integrations_status', 'integrations', ['status'])


def downgrade() -> None:
    op.drop_index('ix_integrations_status', table_name='integrations')
    op.drop_index('ix_integrations_provider', table_name='integrations')
    op.drop_table('integrations')
