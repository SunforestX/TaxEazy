from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.bas_period import BasStatus


class BasPeriodCreate(BaseModel):
    """Schema for creating a new BAS period."""
    start_date: date = Field(..., description="Period start date")
    end_date: date = Field(..., description="Period end date")


class BasPeriodResponse(BaseModel):
    """Schema for BAS period response data."""
    id: UUID
    start_date: date
    end_date: date
    status: BasStatus
    gst_collected: Decimal
    gst_paid: Decimal
    net_gst: Decimal
    total_sales: Decimal
    total_purchases: Decimal
    created_at: datetime
    updated_at: Optional[datetime] = None
    finalised_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BasSummary(BaseModel):
    """Schema for GST/BAS summary calculations."""
    gst_collected: Decimal = Field(..., description="Total GST collected on sales")
    gst_paid: Decimal = Field(..., description="Total GST paid on purchases")
    net_gst: Decimal = Field(..., description="Net GST position (collected - paid)")
    total_sales: Decimal = Field(..., description="Total sales amount")
    total_purchases: Decimal = Field(..., description="Total purchases amount")
    transaction_count: int = Field(..., description="Number of transactions in period")
    unresolved_count: int = Field(..., description="Number of transactions with missing/ambiguous GST treatment")


class BasTransactionItem(BaseModel):
    """Schema for transaction item in BAS drill-down view."""
    id: UUID
    date: date
    description: str
    amount: Decimal
    gst_amount: Optional[Decimal]
    gst_treatment: Optional[str]
    category: Optional[str]
    supplier_name: Optional[str] = None
    reference: Optional[str] = None

    class Config:
        from_attributes = True


class BasExportData(BaseModel):
    """Schema for BAS export data."""
    period_id: UUID
    period_start: date
    period_end: date
    status: str
    generated_at: datetime
    summary: BasSummary
    gst_collected: Decimal
    gst_paid: Decimal
    net_gst: Decimal
    total_sales: Decimal
    total_purchases: Decimal


class BasPeriodListResponse(BaseModel):
    """Schema for paginated BAS period list."""
    items: List[BasPeriodResponse]
    total: int
    page: int
    page_size: int


class BasFinalizeRequest(BaseModel):
    """Schema for finalizing a BAS period."""
    confirm: bool = Field(True, description="Confirm finalization")


class BasFinalizeResponse(BaseModel):
    """Schema for BAS period finalization response."""
    message: str
    period_id: UUID
    status: BasStatus
    finalised_at: datetime
