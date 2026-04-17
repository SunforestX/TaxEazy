from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

from app.models.exception import ExceptionType, Severity, EntityType


class ExceptionResponse(BaseModel):
    id: uuid.UUID
    exception_type: ExceptionType
    severity: Severity
    entity_type: EntityType
    entity_id: uuid.UUID
    message: str
    is_resolved: bool
    resolved_by: Optional[uuid.UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionFilter(BaseModel):
    exception_type: Optional[ExceptionType] = None
    severity: Optional[Severity] = None
    is_resolved: Optional[bool] = None
    entity_type: Optional[EntityType] = None


class ExceptionResolveRequest(BaseModel):
    notes: str


class ExceptionSummary(BaseModel):
    total: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]
    unresolved_count: int


class RuleDefinition(BaseModel):
    id: str
    name: str
    description: str
    exception_type: str
    severity: str
    entity_type: str


class RuleRunResult(BaseModel):
    rule_id: str
    new_exceptions_count: int


class RulesRunSummary(BaseModel):
    results: Dict[str, int]
    total_new_exceptions: int
