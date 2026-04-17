from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Dict, Annotated
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.supplier import Category, GstTreatment
from app.models.transaction import RdRelevance


class TransactionAllocationResponse(BaseModel):
    """Schema for transaction allocation response."""
    id: UUID
    project_id: UUID
    project_name: Optional[str] = None
    percentage: Decimal
    amount: Decimal

    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    """Schema for creating a new transaction."""
    date: Annotated[date, Field(description="Transaction date")]
    description: str = Field(..., min_length=1, max_length=500, description="Transaction description")
    amount: Decimal = Field(..., gt=0, description="Transaction amount")
    gst_amount: Optional[Decimal] = Field(None, ge=0, description="GST amount")
    account_code: Optional[str] = Field(None, max_length=50, description="Account code")
    reference: Optional[str] = Field(None, max_length=100, description="Reference number")
    supplier_id: Optional[UUID] = Field(None, description="Supplier ID")
    category: Optional[Category] = Field(None, description="Expense category")
    gst_treatment: Optional[GstTreatment] = Field(None, description="GST treatment")
    rd_relevance: RdRelevance = Field(default=RdRelevance.NO, description="R&D relevance")
    notes: Optional[str] = Field(None, description="Additional notes")


class TransactionUpdate(BaseModel):
    """Schema for updating an existing transaction."""
    date: Annotated[Optional[date], Field(None, description="Transaction date")]
    description: Optional[str] = Field(None, min_length=1, max_length=500, description="Transaction description")
    amount: Optional[Decimal] = Field(None, gt=0, description="Transaction amount")
    gst_amount: Optional[Decimal] = Field(None, ge=0, description="GST amount")
    account_code: Optional[str] = Field(None, max_length=50, description="Account code")
    reference: Optional[str] = Field(None, max_length=100, description="Reference number")
    supplier_id: Optional[UUID] = Field(None, description="Supplier ID")
    category: Optional[Category] = Field(None, description="Expense category")
    gst_treatment: Optional[GstTreatment] = Field(None, description="GST treatment")
    rd_relevance: Optional[RdRelevance] = Field(None, description="R&D relevance")
    notes: Optional[str] = Field(None, description="Additional notes")
    project_id: Optional[UUID] = Field(None, description="Project ID for allocation")
    allocation_percentage: Optional[Decimal] = Field(None, gt=0, le=100, description="Allocation percentage")


class TransactionResponse(BaseModel):
    """Schema for transaction response data."""
    id: UUID
    date: date
    description: str
    amount: Decimal
    gst_amount: Optional[Decimal]
    account_code: Optional[str]
    reference: Optional[str]
    supplier_id: Optional[UUID]
    supplier_name: Optional[str] = None
    category: Optional[Category]
    gst_treatment: Optional[GstTreatment]
    rd_relevance: RdRelevance
    notes: Optional[str]
    is_reconciled: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    allocations: List[TransactionAllocationResponse] = []

    class Config:
        from_attributes = True


class TransactionFilter(BaseModel):
    """Schema for transaction filtering parameters."""
    date_from: Optional[date] = Field(None, description="Filter transactions from this date")
    date_to: Optional[date] = Field(None, description="Filter transactions to this date")
    category: Optional[Category] = Field(None, description="Filter by category")
    gst_treatment: Optional[GstTreatment] = Field(None, description="Filter by GST treatment")
    rd_relevance: Optional[RdRelevance] = Field(None, description="Filter by R&D relevance")
    supplier_id: Optional[UUID] = Field(None, description="Filter by supplier")
    has_project: Optional[bool] = Field(None, description="Filter by project allocation status")
    min_amount: Optional[Decimal] = Field(None, description="Minimum amount filter")
    max_amount: Optional[Decimal] = Field(None, description="Maximum amount filter")
    search: Optional[str] = Field(None, description="Search in description or reference")


class TransactionSummary(BaseModel):
    """Schema for transaction summary/aggregations."""
    total_count: int = Field(..., description="Total number of transactions")
    total_amount: Decimal = Field(..., description="Total amount of all transactions")
    total_gst_amount: Decimal = Field(..., description="Total GST amount")
    rd_eligible_amount: Decimal = Field(..., description="Amount marked as R&D eligible")
    by_category: Dict[str, Decimal] = Field(default_factory=dict, description="Amount by category")
    by_gst_treatment: Dict[str, Decimal] = Field(default_factory=dict, description="Amount by GST treatment")
    by_rd_relevance: Dict[str, Decimal] = Field(default_factory=dict, description="Amount by R&D relevance")


class BulkClassifyRequest(BaseModel):
    """Schema for bulk classification of transactions."""
    transaction_ids: List[UUID] = Field(..., min_length=1, description="List of transaction IDs to update")
    category: Optional[Category] = Field(None, description="New category to set")
    gst_treatment: Optional[GstTreatment] = Field(None, description="New GST treatment to set")
    rd_relevance: Optional[RdRelevance] = Field(None, description="New R&D relevance to set")
    project_id: Optional[UUID] = Field(None, description="Project ID for allocation")


class CsvRowError(BaseModel):
    """Schema for CSV import row-level errors."""
    row_number: int = Field(..., description="Row number in CSV (1-indexed, including header)")
    error: str = Field(..., description="Error message for this row")


class CsvImportResult(BaseModel):
    """Schema for CSV import result."""
    imported_count: int = Field(..., description="Number of successfully imported transactions")
    error_count: int = Field(..., description="Number of rows with errors")
    errors: List[CsvRowError] = Field(default_factory=list, description="List of row-level errors")


class ProjectAllocationRequest(BaseModel):
    """Schema for allocating a transaction to a project."""
    project_id: UUID = Field(..., description="Project ID to allocate to")
    percentage: Decimal = Field(..., gt=0, le=100, description="Allocation percentage")
