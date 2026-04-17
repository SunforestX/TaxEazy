from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.exception import ExceptionType, Severity
from app.schemas.exception import (
    ExceptionResponse,
    ExceptionFilter,
    ExceptionResolveRequest,
    ExceptionSummary
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.exception import exception_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/exceptions", tags=["Exceptions"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/", response_model=PaginatedResponse[ExceptionResponse])
def list_exceptions(
    exception_type: Optional[ExceptionType] = Query(None, description="Filter by exception type"),
    severity: Optional[Severity] = Query(None, description="Filter by severity"),
    is_resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all exceptions with optional filtering and pagination.
    
    - **exception_type**: Filter by exception type (e.g., missing_gst, uncategorized)
    - **severity**: Filter by severity (low, medium, high)
    - **is_resolved**: Filter by resolved status (true/false)
    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (max 100)
    """
    filters = {
        "exception_type": exception_type,
        "severity": severity,
        "is_resolved": is_resolved
    }
    # Remove None values
    filters = {k: v for k, v in filters.items() if v is not None}
    
    result = exception_service.get_list(
        db=db,
        filters=filters if filters else None,
        page=page,
        page_size=page_size
    )
    return result


@router.get("/summary", response_model=ExceptionSummary)
def get_exception_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get exception counts summary.
    
    Returns total count, breakdown by type, breakdown by severity, and unresolved count.
    """
    summary = exception_service.get_summary(db)
    return summary


@router.get("/{exception_id}", response_model=ExceptionResponse)
def get_exception(
    exception_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific exception by ID.
    
    - **exception_id**: UUID of the exception to retrieve
    """
    exception = exception_service.get_by_id(db, exception_id)
    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exception not found"
        )
    return exception


@router.patch("/{exception_id}/resolve", response_model=ExceptionResponse)
def resolve_exception(
    request: Request,
    exception_id: UUID,
    data: ExceptionResolveRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Mark an exception as resolved (admin only).
    
    - **exception_id**: UUID of the exception to resolve
    - **notes**: Optional resolution notes
    """
    # Check if exception exists
    existing = exception_service.get_by_id(db, exception_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exception not found"
        )
    
    # Check if already resolved
    if existing.is_resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exception is already resolved"
        )
    
    exception = exception_service.resolve(
        db=db,
        exception_id=exception_id,
        user_id=admin.id,
        notes=data.notes
    )
    
    db.commit()
    db.refresh(exception)
    return exception
