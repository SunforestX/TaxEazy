from typing import Optional
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.bas_period import BasStatus
from app.schemas.bas import (
    BasPeriodCreate,
    BasPeriodResponse,
    BasSummary,
    BasTransactionItem,
    BasExportData,
    BasPeriodListResponse,
    BasFinalizeRequest,
    BasFinalizeResponse
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.bas import bas_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/bas", tags=["GST/BAS"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/", response_model=BasPeriodListResponse)
def list_bas_periods(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all BAS periods, newest first.
    
    Returns paginated list of BAS periods with their status and stored values.
    """
    result = bas_service.list_periods(db, page, page_size)
    
    # Transform items to response schema
    items = []
    for period in result["items"]:
        items.append({
            "id": period.id,
            "start_date": period.period_start,
            "end_date": period.period_end,
            "status": period.status,
            "gst_collected": period.gst_collected,
            "gst_paid": period.gst_paid,
            "net_gst": period.net_gst_position,
            "total_sales": Decimal("0"),  # Calculated on demand
            "total_purchases": Decimal("0"),  # Calculated on demand
            "created_at": period.created_at,
            "updated_at": None,
            "finalised_at": period.finalised_at
        })
    
    return {
        "items": items,
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"]
    }


@router.post("/", response_model=BasPeriodResponse, status_code=status.HTTP_201_CREATED)
def create_bas_period(
    request: Request,
    data: BasPeriodCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Create a new BAS period (admin only).
    
    - **start_date**: Period start date
    - **end_date**: Period end date
    """
    from decimal import Decimal
    
    ip_address = get_client_ip(request)
    
    # Validate date range
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    period = bas_service.create_period(
        db=db,
        start_date=data.start_date,
        end_date=data.end_date,
        user_id=admin.id
    )
    
    db.commit()
    db.refresh(period)
    
    return {
        "id": period.id,
        "start_date": period.period_start,
        "end_date": period.period_end,
        "status": period.status,
        "gst_collected": period.gst_collected,
        "gst_paid": period.gst_paid,
        "net_gst": period.net_gst_position,
        "total_sales": Decimal("0"),
        "total_purchases": Decimal("0"),
        "created_at": period.created_at,
        "updated_at": None,
        "finalised_at": period.finalised_at
    }


@router.get("/{period_id}", response_model=dict)
def get_bas_period(
    period_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific BAS period with calculated GST summary.
    
    - **period_id**: UUID of the period to retrieve
    
    Returns period details along with real-time GST calculations.
    """
    from decimal import Decimal
    
    result = bas_service.get_period_with_summary(db, period_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BAS period not found"
        )
    
    period = result["period"]
    summary = result["summary"]
    
    return {
        "id": period.id,
        "start_date": period.period_start,
        "end_date": period.period_end,
        "status": period.status,
        "gst_collected": period.gst_collected if period.status == BasStatus.FINALISED else summary["gst_collected"],
        "gst_paid": period.gst_paid if period.status == BasStatus.FINALISED else summary["gst_paid"],
        "net_gst": period.net_gst_position if period.status == BasStatus.FINALISED else summary["net_gst"],
        "total_sales": summary["total_sales"],
        "total_purchases": summary["total_purchases"],
        "created_at": period.created_at,
        "updated_at": None,
        "finalised_at": period.finalised_at,
        "summary": summary
    }


@router.get("/{period_id}/transactions", response_model=PaginatedResponse[BasTransactionItem])
def get_bas_transactions(
    period_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all transactions within a BAS period date range.
    
    - **period_id**: UUID of the period
    
    Returns paginated transactions with GST breakdown for drill-down analysis.
    """
    result = bas_service.get_period_transactions(db, period_id, page, page_size)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BAS period not found"
        )
    
    return result


@router.get("/{period_id}/unresolved", response_model=PaginatedResponse[BasTransactionItem])
def get_unresolved_transactions(
    period_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get transactions with missing or ambiguous GST treatment.
    
    - **period_id**: UUID of the period
    
    Returns transactions that need GST classification before finalization.
    """
    result = bas_service.get_unresolved(db, period_id, page, page_size)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BAS period not found"
        )
    
    return result


@router.patch("/{period_id}/finalize", response_model=BasFinalizeResponse)
def finalize_bas_period(
    request: Request,
    period_id: UUID,
    data: BasFinalizeRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Mark a BAS period as FINALISED (admin only).
    
    - **period_id**: UUID of the period to finalize
    - **confirm**: Must be true to confirm finalization
    
    Stores calculated GST values and prevents further modifications.
    """
    ip_address = get_client_ip(request)
    
    # Check if period exists
    period = bas_service.get_by_id(db, period_id)
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BAS period not found"
        )
    
    # Check if already finalized
    if period.status == BasStatus.FINALISED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="BAS period is already finalized"
        )
    
    # Check for unresolved items
    summary = bas_service.calculate_gst_summary(db, period.period_start, period.period_end)
    if summary["unresolved_count"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot finalize: {summary['unresolved_count']} unresolved transactions need GST classification"
        )
    
    finalized_period = bas_service.finalize_period(db, period_id, admin.id)
    db.commit()
    
    return {
        "message": "BAS period finalized successfully",
        "period_id": finalized_period.id,
        "status": finalized_period.status,
        "finalised_at": finalized_period.finalised_at
    }


@router.get("/{period_id}/export", response_model=BasExportData)
def export_bas_period(
    period_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export BAS-ready summary data as JSON.
    
    - **period_id**: UUID of the period to export
    
    Returns structured data suitable for CSV/JSON export and BAS reporting.
    """
    result = bas_service.export_period(db, period_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="BAS period not found"
        )
    
    return result
