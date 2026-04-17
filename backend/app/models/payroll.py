import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Date, DateTime, JSON, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pay_date = Column(Date, nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_gross = Column(Numeric(15, 2), default=0)
    total_payg = Column(Numeric(15, 2), default=0)
    total_super = Column(Numeric(15, 2), default=0)
    notes = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    creator = relationship("User", backref="created_payroll_runs")
    items = relationship("PayrollItem", back_populates="payroll_run", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<PayrollRun(id={self.id}, pay_date={self.pay_date})>"


class PayrollItem(Base):
    __tablename__ = "payroll_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_run_id = Column(UUID(as_uuid=True), ForeignKey("payroll_runs.id"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    gross_wages = Column(Numeric(15, 2), nullable=False)
    payg_withheld = Column(Numeric(15, 2), nullable=False)
    super_contribution = Column(Numeric(15, 2), default=0)
    project_allocations = Column(JSON, default=list)  # [{project_id, percentage}]
    notes = Column(Text, nullable=True)

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="items")
    employee = relationship("Employee", backref="payroll_items")

    def __repr__(self):
        return f"<PayrollItem(id={self.id}, employee_id={self.employee_id})>"
