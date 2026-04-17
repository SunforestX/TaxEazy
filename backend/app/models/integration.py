import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class IntegrationStatus:
    """Integration connection status constants."""
    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    ERROR = "error"


class Integration(Base):
    """Model for storing accounting system integrations (Xero, MYOB, etc.)."""
    
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider = Column(String(50), nullable=False, index=True)
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    tenant_id = Column(String(255), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default=IntegrationStatus.DISCONNECTED)
    config = Column(JSONB, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Integration(id={self.id}, provider={self.provider}, status={self.status})>"
