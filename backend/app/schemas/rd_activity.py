from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class RdActivityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    activity_date: date
    hours: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    personnel: Optional[str] = Field(None, max_length=255)
    methodology: Optional[str] = None
    results: Optional[str] = None
    notes: Optional[str] = None


class RdActivityCreate(RdActivityBase):
    pass


class RdActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    activity_date: Optional[date] = None
    hours: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    personnel: Optional[str] = Field(None, max_length=255)
    methodology: Optional[str] = None
    results: Optional[str] = None
    notes: Optional[str] = None


class RdActivityResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    activity_date: date
    hours: Optional[Decimal] = None
    personnel: Optional[str] = None
    methodology: Optional[str] = None
    results: Optional[str] = None
    notes: Optional[str] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
