import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Date, DateTime, Boolean, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.database import Base
from app.models.supplier import Category, GstTreatment


class RdRelevance(str, enum.Enum):
    YES = "yes"
    PARTIAL = "partial"
    NO = "no"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    description = Column(String(500), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    gst_treatment = Column(Enum(GstTreatment), nullable=True)
    gst_amount = Column(Numeric(15, 2), nullable=True)
    category = Column(Enum(Category), nullable=True)
    rd_relevance = Column(Enum(RdRelevance), nullable=False, default=RdRelevance.NO)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    attachment_path = Column(String(500), nullable=True)
    is_reconciled = Column(Boolean, default=False, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    supplier = relationship("Supplier", backref="transactions")
    project = relationship("Project", backref="transactions")
    creator = relationship("User", backref="created_transactions")
    allocations = relationship("TransactionAllocation", back_populates="transaction", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Transaction(id={self.id}, date={self.date}, amount={self.amount})>"


class TransactionAllocation(Base):
    __tablename__ = "transaction_allocations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    percentage = Column(Numeric(5, 2), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)

    # Relationships
    transaction = relationship("Transaction", back_populates="allocations")
    project = relationship("Project", backref="transaction_allocations")

    def __repr__(self):
        return f"<TransactionAllocation(id={self.id}, percentage={self.percentage})>"
