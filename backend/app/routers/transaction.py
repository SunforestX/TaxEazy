from typing import Optional
from uuid import UUID
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionFilter,
    TransactionSummary,
    BulkClassifyRequest,
    CsvImportResult,
    ProjectAllocationRequest
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.transaction import transaction_service
from app.services.csv_import import csv_import_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/", response_model=PaginatedResponse[TransactionResponse])
def list_transactions(
    request: Request,
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    gst_treatment: Optional[str] = Query(None, description="Filter by GST treatment"),
    rd_relevance: Optional[str] = Query(None, description="Filter by R&D relevance"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier ID"),
    has_project: Optional[bool] = Query(None, description="Filter by project allocation"),
    min_amount: Optional[Decimal] = Query(None, description="Minimum amount"),
    max_amount: Optional[Decimal] = Query(None, description="Maximum amount"),
    search: Optional[str] = Query(None, description="Search in description/reference"),
    sort_by: str = Query("date", description="Sort column"),
    sort_order: str = Query("desc", description="Sort direction (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List transactions with filtering, sorting, and pagination.
    
    All filter parameters are optional. Results include supplier names.
    """
    from app.models.supplier import Category, GstTreatment
    from app.models.transaction import RdRelevance
    
    # Build filter object
    filters = TransactionFilter(
        date_from=date_from,
        date_to=date_to,
        has_project=has_project,
        supplier_id=supplier_id,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search
    )
    
    # Parse enum filters
    if category:
        try:
            filters.category = Category(category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}"
            )
    
    if gst_treatment:
        try:
            filters.gst_treatment = GstTreatment(gst_treatment)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid GST treatment: {gst_treatment}"
            )
    
    if rd_relevance:
        try:
            filters.rd_relevance = RdRelevance(rd_relevance)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid R&D relevance: {rd_relevance}"
            )
    
    result = transaction_service.get_list(
        db=db,
        filters=filters,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    return result


@router.get("/summary", response_model=TransactionSummary)
def get_transaction_summary(
    date_from: Optional[date] = Query(None, description="Filter from date"),
    date_to: Optional[date] = Query(None, description="Filter to date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    gst_treatment: Optional[str] = Query(None, description="Filter by GST treatment"),
    rd_relevance: Optional[str] = Query(None, description="Filter by R&D relevance"),
    supplier_id: Optional[UUID] = Query(None, description="Filter by supplier ID"),
    has_project: Optional[bool] = Query(None, description="Filter by project allocation"),
    min_amount: Optional[Decimal] = Query(None, description="Minimum amount"),
    max_amount: Optional[Decimal] = Query(None, description="Maximum amount"),
    search: Optional[str] = Query(None, description="Search in description/reference"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated transaction summary with filters.
    
    Returns totals by category, GST treatment, and R&D relevance.
    """
    from app.models.supplier import Category, GstTreatment
    from app.models.transaction import RdRelevance
    
    # Build filter object
    filters = TransactionFilter(
        date_from=date_from,
        date_to=date_to,
        has_project=has_project,
        supplier_id=supplier_id,
        min_amount=min_amount,
        max_amount=max_amount,
        search=search
    )
    
    # Parse enum filters
    if category:
        try:
            filters.category = Category(category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}"
            )
    
    if gst_treatment:
        try:
            filters.gst_treatment = GstTreatment(gst_treatment)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid GST treatment: {gst_treatment}"
            )
    
    if rd_relevance:
        try:
            filters.rd_relevance = RdRelevance(rd_relevance)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid R&D relevance: {rd_relevance}"
            )
    
    summary = transaction_service.get_summary(db, filters)
    return summary


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific transaction by ID with allocations.
    
    - **transaction_id**: UUID of the transaction to retrieve
    """
    transaction = transaction_service.get_by_id_with_allocations(db, transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    return transaction


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    request: Request,
    data: TransactionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Create a new transaction (admin only).
    
    - **date**: Transaction date (required)
    - **description**: Transaction description (required)
    - **amount**: Transaction amount (required)
    - **gst_amount**: GST amount (optional)
    - **account_code**: Account code (optional)
    - **reference**: Reference number (optional)
    - **supplier_id**: Supplier UUID (optional)
    - **category**: Expense category (optional)
    - **gst_treatment**: GST treatment (optional)
    - **rd_relevance**: R&D relevance (default: NO)
    - **notes**: Additional notes (optional)
    """
    ip_address = get_client_ip(request)
    
    transaction = transaction_service.create(
        db=db,
        data=data.model_dump(),
        user_id=admin.id,
        ip_address=ip_address
    )
    
    db.commit()
    db.refresh(transaction)
    
    # Return with supplier name
    return transaction_service.get_by_id_with_allocations(db, transaction.id)


@router.post("/import", response_model=CsvImportResult)
async def import_transactions_csv(
    request: Request,
    csv_file: UploadFile = File(..., description="CSV file to import"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Bulk import transactions from CSV (admin only).
    
    Expected CSV columns:
    - **date** (required): Transaction date (YYYY-MM-DD, DD/MM/YYYY)
    - **description** (required): Transaction description
    - **amount** (required): Transaction amount
    - **gst_amount** (optional): GST amount
    - **account_code** (optional): Account code
    - **reference** (optional): Reference number
    - **supplier_name** (optional): Supplier name (will try to match)
    - **category** (optional): Category (Equipment, Consumables, etc.)
    - **gst_treatment** (optional): GST treatment (CAP, EXP, FRE, etc.)
    """
    # Validate file type
    if not csv_file.filename or not csv_file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    result = await csv_import_service.import_transactions(
        db=db,
        csv_file=csv_file,
        user_id=admin.id
    )
    
    db.commit()
    return result


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    request: Request,
    transaction_id: UUID,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update an existing transaction (admin only).
    
    - **transaction_id**: UUID of the transaction to update
    - All fields are optional; only provided fields will be updated
    """
    ip_address = get_client_ip(request)
    
    # Check if transaction exists
    existing = transaction_service.get_by_id(db, transaction_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    # Filter out None values
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    transaction = transaction_service.update(
        db=db,
        entity_id=transaction_id,
        data=update_data,
        user_id=admin.id,
        ip_address=ip_address
    )
    
    db.commit()
    
    # Return with allocations
    return transaction_service.get_by_id_with_allocations(db, transaction_id)


@router.patch("/bulk-classify", response_model=SuccessResponse)
def bulk_classify_transactions(
    request: Request,
    data: BulkClassifyRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Bulk update classification for multiple transactions (admin only).
    
    - **transaction_ids**: List of transaction UUIDs to update
    - **category**: New category (optional)
    - **gst_treatment**: New GST treatment (optional)
    - **rd_relevance**: New R&D relevance (optional)
    - **project_id**: Project ID for allocation (optional)
    """
    ip_address = get_client_ip(request)
    
    result = transaction_service.bulk_classify(
        db=db,
        request=data,
        user_id=admin.id
    )
    
    db.commit()
    
    return SuccessResponse(
        message=f"Updated {result['updated_count']} transactions",
        id=None
    )


@router.post("/{transaction_id}/allocate", response_model=SuccessResponse)
def allocate_transaction(
    request: Request,
    transaction_id: UUID,
    data: ProjectAllocationRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Allocate a transaction to a project (admin only).
    
    - **transaction_id**: UUID of the transaction
    - **project_id**: UUID of the project to allocate to
    - **percentage**: Allocation percentage (0-100)
    """
    ip_address = get_client_ip(request)
    
    # Check if transaction exists
    existing = transaction_service.get_by_id(db, transaction_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    try:
        transaction_service.allocate_to_project(
            db=db,
            transaction_id=transaction_id,
            project_id=data.project_id,
            percentage=data.percentage,
            user_id=admin.id
        )
        db.commit()
        
        return SuccessResponse(
            message="Transaction allocated successfully",
            id=transaction_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{transaction_id}", response_model=SuccessResponse)
def delete_transaction(
    request: Request,
    transaction_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Delete a transaction (admin only).
    
    - **transaction_id**: UUID of the transaction to delete
    """
    ip_address = get_client_ip(request)
    
    # Check if transaction exists
    existing = transaction_service.get_by_id(db, transaction_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )
    
    success = transaction_service.delete(
        db=db,
        entity_id=transaction_id,
        user_id=admin.id,
        ip_address=ip_address
    )
    
    if success:
        db.commit()
        return SuccessResponse(
            message="Transaction deleted successfully",
            id=transaction_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete transaction"
        )
