import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class ActionType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    IMPORT = "import"
    UPLOAD = "upload"
    STATUS_CHANGE = "status_change"


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(Enum(ActionType), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    changes = Column(JSON, default=dict)  # {old: {}, new: {}}
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AuditEvent(id={self.id}, action={self.action}, entity={self.entity_type})>"
