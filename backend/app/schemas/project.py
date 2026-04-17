from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.project import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.PLANNING
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    eligibility_rationale: Optional[str] = None
    notes: Optional[str] = None


class ProjectCreate(ProjectBase):
    code: str = Field(..., min_length=1, max_length=50)
    scientific_rationale: Optional[str] = None
    eligibility_notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    eligibility_rationale: Optional[str] = None
    notes: Optional[str] = None
    scientific_rationale: Optional[str] = None
    eligibility_notes: Optional[str] = None


class ProjectResponse(BaseModel):
    id: UUID
    code: str
    name: str
    description: Optional[str] = None
    status: ProjectStatus
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectStats(BaseModel):
    activities_count: int
    total_spend: Decimal
    evidence_completeness: float  # Percentage 0-100


class ProjectDetail(ProjectResponse):
    scientific_rationale: Optional[str] = None
    eligibility_notes: Optional[str] = None
    activities_count: int
    total_spend: Decimal
    evidence_status: dict


class ProjectListItem(ProjectResponse):
    activities_count: int
    total_spend: Decimal
    evidence_completeness: float
