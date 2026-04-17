from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from app.schemas.common import PaginatedResponse
from app.services.employee import employee_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("/", response_model=PaginatedResponse[EmployeeResponse])
def list_employees(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_scientist: Optional[bool] = Query(None, description="Filter by scientist status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated list of employees.
    
    Supports filtering by active status, scientist status, and search query.
    """
    if search:
        result = employee_service.search_employees(db, search, page, page_size)
    elif is_active is not None and is_active:
        result = employee_service.get_active_employees(db, page, page_size)
    elif is_scientist is not None and is_scientist:
        result = employee_service.get_scientists(db, page, page_size)
    else:
        filters = {}
        if is_active is not None:
            filters["is_active"] = is_active
        if is_scientist is not None:
            filters["is_scientist"] = is_scientist
        result = employee_service.get_list(db, page=page, page_size=page_size, filters=filters)
    
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"]
    )


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific employee by ID."""
    employee = employee_service.get_by_id(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    return employee


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    request: EmployeeCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Create a new employee (admin only).
    
    Creates an employee record with the provided details.
    """
    # Check if email already exists
    if request.email:
        existing = employee_service.get_by_email(db, request.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee with this email already exists"
            )
    
    employee_data = request.model_dump()
    employee = employee_service.create(
        db,
        data=employee_data,
        user_id=admin.id
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: UUID,
    request: EmployeeUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update an employee (admin only).
    
    Partial update - only provided fields will be updated.
    """
    employee = employee_service.get_by_id(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    # Check if email is being changed and if it's already taken
    if request.email and request.email != employee.email:
        existing = employee_service.get_by_email(db, request.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee with this email already exists"
            )
    
    update_data = {k: v for k, v in request.model_dump().items() if v is not None}
    
    employee = employee_service.update(
        db,
        entity_id=employee_id,
        data=update_data,
        user_id=admin.id
    )
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    employee_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Delete an employee (admin only).
    
    Performs a hard delete of the employee record.
    """
    employee = employee_service.get_by_id(db, employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found"
        )
    
    employee_service.delete(db, employee_id, user_id=admin.id)
    db.commit()
    return None
