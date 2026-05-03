import uuid
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent, ActionType


def _serialize_value(val: Any) -> Any:
    """Convert non-JSON-serializable types to JSON-safe representations."""
    if val is None:
        return val
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return str(val)
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, Enum):
        return val.value
    if isinstance(val, dict):
        return {k: _serialize_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple)):
        return [_serialize_value(v) for v in val]
    return val


def _serialize_dict(d: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Recursively serialize a dict so it is JSON-safe."""
    if d is None:
        return None
    return {k: _serialize_value(v) for k, v in d.items()}


def log_audit_event(
    db: Session,
    user_id: Optional[uuid.UUID],
    action: ActionType,
    entity_type: str,
    entity_id: uuid.UUID,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
) -> AuditEvent:
    """
    Log an audit event to the database.
    
    Args:
        db: SQLAlchemy database session
        user_id: UUID of the user performing the action (None for system actions)
        action: Type of action (CREATE, UPDATE, DELETE, IMPORT, UPLOAD, STATUS_CHANGE)
        entity_type: Name of the entity being modified (e.g., "User", "Transaction")
        entity_id: UUID of the entity being modified
        old_values: Dictionary of old values before the change (for updates/deletes)
        new_values: Dictionary of new values after the change (for creates/updates)
        ip_address: Optional IP address of the user
    
    Returns:
        The created AuditEvent instance
    """
    changes = {}
    if old_values is not None:
        changes["old"] = _serialize_dict(old_values)
    if new_values is not None:
        changes["new"] = _serialize_dict(new_values)
    
    audit_event = AuditEvent(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes if changes else None,
        ip_address=ip_address
    )
    
    db.add(audit_event)
    db.flush()  # Flush to get the ID without committing the transaction
    
    return audit_event


def log_create(
    db: Session,
    user_id: Optional[uuid.UUID],
    entity_type: str,
    entity_id: uuid.UUID,
    new_values: Dict[str, Any],
    ip_address: Optional[str] = None
) -> AuditEvent:
    """Convenience function to log a CREATE action."""
    return log_audit_event(
        db=db,
        user_id=user_id,
        action=ActionType.CREATE,
        entity_type=entity_type,
        entity_id=entity_id,
        new_values=new_values,
        ip_address=ip_address
    )


def log_update(
    db: Session,
    user_id: Optional[uuid.UUID],
    entity_type: str,
    entity_id: uuid.UUID,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
    ip_address: Optional[str] = None
) -> AuditEvent:
    """Convenience function to log an UPDATE action."""
    return log_audit_event(
        db=db,
        user_id=user_id,
        action=ActionType.UPDATE,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address
    )


def log_delete(
    db: Session,
    user_id: Optional[uuid.UUID],
    entity_type: str,
    entity_id: uuid.UUID,
    old_values: Dict[str, Any],
    ip_address: Optional[str] = None
) -> AuditEvent:
    """Convenience function to log a DELETE action."""
    return log_audit_event(
        db=db,
        user_id=user_id,
        action=ActionType.DELETE,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        ip_address=ip_address
    )
