from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.supplier import supplier_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/", response_model=PaginatedResponse[SupplierResponse])
def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name or ABN"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all suppliers with optional search and pagination.
    
    - **search**: Optional search term to filter by name or ABN
    - **page**: Page number (1-indexed)
    - **page_size**: Number of items per page (max 100)
    """
    result = supplier_service.get_list(
        db=db,
        page=page,
        page_size=page_size,
        filters={"is_active": True},
        search=search
    )
    return result


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific supplier by ID.
    
    - **supplier_id**: UUID of the supplier to retrieve
    """
    supplier = supplier_service.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    return supplier


@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    request: Request,
    data: SupplierCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Create a new supplier (admin only).
    
    - **name**: Supplier name (required)
    - **abn**: Australian Business Number (optional)
    - **contact_name**: Contact person name (optional)
    - **contact_email**: Contact email address (optional)
    - **phone**: Phone number (optional)
    - **address**: Physical address (optional)
    - **gst_registered**: Whether supplier is GST registered (default: true)
    - **default_gst_treatment**: Default GST treatment (optional)
    - **default_category**: Default expense category (optional)
    - **is_rd_supplier**: Whether supplier provides R&D services (default: false)
    - **notes**: Additional notes (optional)
    """
    ip_address = get_client_ip(request)
    
    supplier = supplier_service.create(
        db=db,
        data=data.model_dump(),
        user_id=admin.id,
        ip_address=ip_address
    )
    
    db.commit()
    db.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    request: Request,
    supplier_id: UUID,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update an existing supplier (admin only).
    
    - **supplier_id**: UUID of the supplier to update
    - All fields are optional; only provided fields will be updated
    """
    ip_address = get_client_ip(request)
    
    # Check if supplier exists
    existing = supplier_service.get_by_id(db, supplier_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    # Filter out None values
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    supplier = supplier_service.update(
        db=db,
        entity_id=supplier_id,
        data=update_data,
        user_id=admin.id,
        ip_address=ip_address
    )
    
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", response_model=SuccessResponse)
def delete_supplier(
    request: Request,
    supplier_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Soft delete a supplier by setting is_active to False (admin only).
    
    - **supplier_id**: UUID of the supplier to delete
    """
    ip_address = get_client_ip(request)
    
    # Check if supplier exists
    existing = supplier_service.get_by_id(db, supplier_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    
    success = supplier_service.soft_delete(
        db=db,
        entity_id=supplier_id,
        user_id=admin.id,
        ip_address=ip_address
    )
    
    if success:
        db.commit()
        return SuccessResponse(message="Supplier deleted successfully", id=supplier_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete supplier"
        )
