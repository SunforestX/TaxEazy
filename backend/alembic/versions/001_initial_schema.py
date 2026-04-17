"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-04-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('ADMIN', 'ACCOUNTANT', name='userrole'), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Create company table
    op.create_table(
        'company',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('abn', sa.String(20), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('financial_year_end', sa.String(5), nullable=False),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create suppliers table
    op.create_table(
        'suppliers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('abn', sa.String(20), nullable=True),
        sa.Column('contact_info', postgresql.JSONB(astext_type=sa.Text()), default={}),
        sa.Column('default_category', sa.Enum('EQUIPMENT', 'CONSUMABLES', 'SERVICES', 'CRO_CONTRACT', 'SALARIES', 'OVERHEADS', 'TRAVEL', 'OTHER', name='category'), nullable=True),
        sa.Column('default_gst_treatment', sa.Enum('CAP', 'EXP', 'FRE', 'INP', 'NTR', 'MIX', name='gsttreatment'), nullable=True),
        sa.Column('notes', sa.String(1000), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_suppliers_name', 'suppliers', ['name'])

    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scientific_rationale', sa.Text(), nullable=True),
        sa.Column('eligibility_notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD', name='projectstatus'), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('budget', sa.Numeric(15, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )

    # Create employees table
    op.create_table(
        'employees',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('is_scientist', sa.Boolean(), nullable=False, default=False),
        sa.Column('default_project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.String(1000), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['default_project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create transactions table
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('gst_treatment', sa.Enum('CAP', 'EXP', 'FRE', 'INP', 'NTR', 'MIX', name='gsttreatment'), nullable=True),
        sa.Column('gst_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('category', sa.Enum('EQUIPMENT', 'CONSUMABLES', 'SERVICES', 'CRO_CONTRACT', 'SALARIES', 'OVERHEADS', 'TRAVEL', 'OTHER', name='category'), nullable=True),
        sa.Column('rd_relevance', sa.Enum('YES', 'PARTIAL', 'NO', name='rdrelevance'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('attachment_path', sa.String(500), nullable=True),
        sa.Column('is_reconciled', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_transactions_date', 'transactions', ['date'])
    op.create_index('ix_transactions_project_id', 'transactions', ['project_id'])

    # Create transaction_allocations table
    op.create_table(
        'transaction_allocations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('percentage', sa.Numeric(5, 2), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create rd_activities table
    op.create_table(
        'rd_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('activity_date', sa.Date(), nullable=False),
        sa.Column('owner', sa.String(255), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('hours_logged', sa.Numeric(5, 2), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_rd_activities_project_id', 'rd_activities', ['project_id'])

    # Create evidence_files table
    op.create_table(
        'evidence_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('file_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.String(50), nullable=True),
        sa.Column('linked_type', sa.Enum('TRANSACTION', 'PAYROLL', 'PROJECT', 'ACTIVITY', name='linkedtype'), nullable=False),
        sa.Column('linked_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create payroll_runs table
    op.create_table(
        'payroll_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pay_date', sa.Date(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('total_gross', sa.Numeric(15, 2), default=0),
        sa.Column('total_payg', sa.Numeric(15, 2), default=0),
        sa.Column('total_super', sa.Numeric(15, 2), default=0),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create payroll_items table
    op.create_table(
        'payroll_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('gross_wages', sa.Numeric(15, 2), nullable=False),
        sa.Column('payg_withheld', sa.Numeric(15, 2), nullable=False),
        sa.Column('super_contribution', sa.Numeric(15, 2), default=0),
        sa.Column('project_allocations', postgresql.JSONB(astext_type=sa.Text()), default=list),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id']),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create bas_periods table
    op.create_table(
        'bas_periods',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('gst_collected', sa.Numeric(15, 2), default=0),
        sa.Column('gst_paid', sa.Numeric(15, 2), default=0),
        sa.Column('net_gst_position', sa.Numeric(15, 2), default=0),
        sa.Column('status', sa.Enum('DRAFT', 'FINALISED', name='basstatus'), nullable=False),
        sa.Column('finalised_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # Create exceptions table
    op.create_table(
        'exceptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('exception_type', sa.Enum('MISSING_GST', 'UNCATEGORIZED', 'UNLINKED_RD_SPEND', 'MISSING_EVIDENCE', 'MISSING_PAYROLL_ALLOCATION', 'HIGH_VALUE_NO_PROJECT', name='exceptiontype'), nullable=False),
        sa.Column('severity', sa.Enum('LOW', 'MEDIUM', 'HIGH', name='severity'), nullable=False),
        sa.Column('entity_type', sa.Enum('TRANSACTION', 'PAYROLL_ITEM', 'PROJECT', name='entitytype'), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_resolved', sa.Boolean(), nullable=False, default=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_exceptions_is_resolved', 'exceptions', ['is_resolved'])
    op.create_index('ix_exceptions_severity', 'exceptions', ['severity'])

    # Create audit_events table
    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.Enum('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'UPLOAD', 'STATUS_CHANGE', name='actiontype'), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), default=dict),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('audit_events')
    op.drop_table('exceptions')
    op.drop_table('bas_periods')
    op.drop_table('payroll_items')
    op.drop_table('payroll_runs')
    op.drop_table('evidence_files')
    op.drop_table('rd_activities')
    op.drop_table('transaction_allocations')
    op.drop_table('transactions')
    op.drop_table('employees')
    op.drop_table('projects')
    op.drop_table('suppliers')
    op.drop_table('company')
    op.drop_table('users')
    
    # Drop enum types
    op.execute('DROP TYPE IF EXISTS actiontype')
    op.execute('DROP TYPE IF EXISTS entitytype')
    op.execute('DROP TYPE IF EXISTS severity')
    op.execute('DROP TYPE IF EXISTS exceptiontype')
    op.execute('DROP TYPE IF EXISTS basstatus')
    op.execute('DROP TYPE IF EXISTS linkedtype')
    op.execute('DROP TYPE IF EXISTS projectstatus')
    op.execute('DROP TYPE IF EXISTS rdrelevance')
    op.execute('DROP TYPE IF EXISTS category')
    op.execute('DROP TYPE IF EXISTS gsttreatment')
    op.execute('DROP TYPE IF EXISTS userrole')
