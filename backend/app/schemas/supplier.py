from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.supplier import Category, GstTreatment


class SupplierBase(BaseModel):
    """Base schema for supplier data."""
    name: str = Field(..., min_length=1, max_length=255, description="Supplier name")
    abn: Optional[str] = Field(None, max_length=20, description="Australian Business Number")
    contact_name: Optional[str] = Field(None, max_length=255, description="Contact person name")
    contact_email: Optional[str] = Field(None, max_length=255, description="Contact email address")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    address: Optional[str] = Field(None, max_length=500, description="Physical address")
    gst_registered: bool = Field(default=True, description="Whether supplier is GST registered")
    default_gst_treatment: Optional[GstTreatment] = Field(None, description="Default GST treatment")
    default_category: Optional[Category] = Field(None, description="Default expense category")
    is_rd_supplier: bool = Field(default=False, description="Whether supplier provides R&D services")
    notes: Optional[str] = Field(None, max_length=1000, description="Additional notes")
    is_active: bool = Field(default=True, description="Whether supplier is active")


class SupplierCreate(SupplierBase):
    """Schema for creating a new supplier."""
    pass


class SupplierUpdate(BaseModel):
    """Schema for updating an existing supplier."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    abn: Optional[str] = Field(None, max_length=20)
    contact_name: Optional[str] = Field(None, max_length=255)
    contact_email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)
    gst_registered: Optional[bool] = None
    default_gst_treatment: Optional[GstTreatment] = None
    default_category: Optional[Category] = None
    is_rd_supplier: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    """Schema for supplier response data."""
    id: UUID
    name: str
    abn: Optional[str]
    contact_name: Optional[str]
    contact_email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    gst_registered: bool
    default_gst_treatment: Optional[GstTreatment]
    default_category: Optional[Category]
    is_rd_supplier: bool
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
