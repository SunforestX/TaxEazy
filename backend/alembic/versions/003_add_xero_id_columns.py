"""Add xero_id columns to transactions and suppliers

Revision ID: 003
Revises: 002
Create Date: 2026-05-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add xero_id and source to transactions
    op.add_column('transactions', sa.Column('xero_id', sa.String(), nullable=True))
    op.add_column('transactions', sa.Column('source', sa.String(), nullable=True))
    op.create_index('ix_transactions_xero_id', 'transactions', ['xero_id'], unique=True)
    op.create_index('ix_transactions_source', 'transactions', ['source'])

    # Add xero_id to suppliers
    op.add_column('suppliers', sa.Column('xero_id', sa.String(), nullable=True))
    op.create_index('ix_suppliers_xero_id', 'suppliers', ['xero_id'], unique=True)

    # Make created_by nullable (Xero-synced transactions have no user)
    op.alter_column('transactions', 'created_by', existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column('transactions', 'created_by', existing_type=sa.UUID(), nullable=False)
    op.drop_index('ix_suppliers_xero_id', table_name='suppliers')
    op.drop_column('suppliers', 'xero_id')
    op.drop_index('ix_transactions_source', table_name='transactions')
    op.drop_index('ix_transactions_xero_id', table_name='transactions')
    op.drop_column('transactions', 'source')
    op.drop_column('transactions', 'xero_id')
