from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID


class CompanyResponse(BaseModel):
    id: UUID
    name: str
    abn: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[str] = None
    financial_year_end: str
    settings: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    abn: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    financial_year_end: Optional[str] = None
    settings: Optional[dict] = None
