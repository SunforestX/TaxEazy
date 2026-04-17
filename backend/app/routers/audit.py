from typing import Optional
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.database import get_db
from app.models.audit_event import AuditEvent, ActionType
from app.models.user import User
from app.schemas.audit import AuditEventResponse
from app.schemas.common import PaginatedResponse
from app.utils.auth import require_admin
from app.utils.pagination import paginate

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/", response_model=PaginatedResponse[AuditEventResponse])
def list_audit_events(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    action: Optional[ActionType] = Query(None, description="Filter by action type"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    List audit events with optional filtering (admin only).
    
    Returns paginated audit events ordered by creation date descending.
    """
    # Build base query
    query = select(AuditEvent)
    
    # Build dynamic filters
    conditions = []
    
    if entity_type is not None:
        conditions.append(AuditEvent.entity_type == entity_type)
    
    if action is not None:
        conditions.append(AuditEvent.action == action)
    
    if user_id is not None:
        conditions.append(AuditEvent.user_id == user_id)
    
    if start_date is not None:
        conditions.append(AuditEvent.timestamp >= start_date)
    
    if end_date is not None:
        conditions.append(AuditEvent.timestamp <= end_date)
    
    # Apply filters if any exist
    if conditions:
        query = query.where(and_(*conditions))
    
    # Order by timestamp descending (most recent first)
    query = query.order_by(AuditEvent.timestamp.desc())
    
    # Apply pagination
    result = paginate(db, query, page, page_size)
    
    # Map timestamp to created_at for response compatibility
    items = []
    for event in result["items"]:
        event_dict = {
            "id": event.id,
            "user_id": event.user_id,
            "action": event.action,
            "entity_type": event.entity_type,
            "entity_id": event.entity_id,
            "changes": event.changes,
            "ip_address": event.ip_address,
            "created_at": event.timestamp
        }
        items.append(event_dict)
    
    return {
        "items": items,
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"]
    }
