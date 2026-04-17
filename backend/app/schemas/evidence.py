from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel

from app.models.evidence_file import LinkedType


class EvidenceFileCreate(BaseModel):
    """Schema for creating an evidence file record."""
    linked_type: LinkedType
    linked_id: UUID
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class EvidenceFileResponse(BaseModel):
    """Schema for evidence file response."""
    id: UUID
    filename: str
    storage_path: str
    file_type: Optional[str] = None
    file_size: Optional[str] = None
    linked_type: LinkedType
    linked_id: UUID
    uploaded_by: UUID
    uploaded_at: datetime
    description: Optional[str] = None
    tags: Optional[List[str]] = None

    class Config:
        from_attributes = True


class EvidenceFilter(BaseModel):
    """Schema for filtering evidence files."""
    linked_type: Optional[LinkedType] = None
    linked_id: Optional[UUID] = None

    class Config:
        from_attributes = True
