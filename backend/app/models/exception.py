import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class ExceptionType(str, enum.Enum):
    MISSING_GST = "missing_gst"
    UNCATEGORIZED = "uncategorized"
    UNLINKED_RD_SPEND = "unlinked_rd_spend"
    MISSING_EVIDENCE = "missing_evidence"
    MISSING_PAYROLL_ALLOCATION = "missing_payroll_allocation"
    HIGH_VALUE_NO_PROJECT = "high_value_no_project"


class Severity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class EntityType(str, enum.Enum):
    TRANSACTION = "transaction"
    PAYROLL_ITEM = "payroll_item"
    PROJECT = "project"


class Exception(Base):
    __tablename__ = "exceptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exception_type = Column(Enum(ExceptionType), nullable=False)
    severity = Column(Enum(Severity), nullable=False, default=Severity.MEDIUM)
    entity_type = Column(Enum(EntityType), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    message = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Exception(id={self.id}, type={self.exception_type}, resolved={self.is_resolved})>"
