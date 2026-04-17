from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

from app.models.audit_event import ActionType


class AuditEventResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    action: ActionType
    entity_type: str
    entity_id: uuid.UUID
    changes: Dict[str, Any]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditFilter(BaseModel):
    entity_type: Optional[str] = None
    action: Optional[ActionType] = None
    user_id: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
