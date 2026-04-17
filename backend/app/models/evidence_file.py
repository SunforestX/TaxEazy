import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.database import Base


class LinkedType(str, enum.Enum):
    TRANSACTION = "transaction"
    PAYROLL = "payroll"
    PROJECT = "project"
    ACTIVITY = "activity"


class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=True)
    file_size = Column(String(50), nullable=True)
    linked_type = Column(Enum(LinkedType), nullable=False)
    linked_id = Column(UUID(as_uuid=True), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(ARRAY(String), nullable=True)

    def __repr__(self):
        return f"<EvidenceFile(id={self.id}, filename={self.filename})>"
