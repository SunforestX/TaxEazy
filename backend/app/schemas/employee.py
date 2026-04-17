from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class EmployeeBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    position: Optional[str] = None
    is_scientist: bool = False
    is_active: bool = True
    employment_start_date: Optional[datetime] = None
    employment_end_date: Optional[datetime] = None
    annual_salary: Optional[float] = None
    notes: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    position: Optional[str] = None
    is_scientist: Optional[bool] = None
    is_active: Optional[bool] = None
    employment_start_date: Optional[datetime] = None
    employment_end_date: Optional[datetime] = None
    annual_salary: Optional[float] = None
    notes: Optional[str] = None


class EmployeeResponse(EmployeeBase):
    id: UUID
    default_project_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
