from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.payroll import (
    PayrollRunCreate,
    PayrollRunUpdate,
    PayrollRunResponse,
    PayrollRunListResponse,
    PayrollItemUpdate,
    PayrollItemResponse,
    PaygMonthlySummary,
    PayrollImportResult
)
from app.schemas.common import PaginatedResponse
from app.services.payroll import payroll_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/payroll", tags=["Payroll"])


@router.get("/", response_model=PaginatedResponse[PayrollRunListResponse])
def list_payroll_runs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    start_date: Optional[date] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated list of payroll runs with optional date filtering.
    
    Supports filtering by date range to narrow down results.
    """
    result = payroll_service.get_runs_with_date_filter(
        db,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )
    
    # Calculate item count for each run
    items = []
    for run in result["items"]:
        item_count = len(run.items) if hasattr(run, 'items') and run.items else 0
        # Create a dict with item_count included
        run_dict = {
            "id": run.id,
            "pay_date": run.pay_date,
            "period_start": run.period_start,
            "period_end": run.period_end,
            "total_gross": run.total_gross,
            "total_payg": run.total_payg,
            "total_super": run.total_super,
            "created_by": run.created_by,
            "created_at": run.created_at,
            "item_count": item_count
        }
        items.append(run_dict)
    
    return PaginatedResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"]
    )


@router.get("/{run_id}", response_model=PayrollRunResponse)
def get_payroll_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific payroll run with all its items.
    
    Returns the payroll run details including all employee items.
    """
    payroll_run = payroll_service.get_run_with_items(db, run_id)
    if not payroll_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found"
        )
    return payroll_run


@router.post("/", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
def create_payroll_run(
    request: PayrollRunCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Create a new payroll run with items (admin only).
    
    Creates a payroll run and associated payroll items in a single transaction.
    Totals are automatically calculated from the items.
    """
    run_data = {
        "pay_date": request.pay_date,
        "period_start": request.period_start,
        "period_end": request.period_end,
        "notes": request.notes
    }
    
    items_data = []
    for item in request.items:
        items_data.append({
            "employee_id": item.employee_id,
            "gross_wages": item.gross_wages,
            "payg_withheld": item.payg_withheld,
            "super_amount": item.super_amount,
            "net_pay": item.net_pay,
            "project_allocations": item.project_allocations,
            "notes": item.notes
        })
    
    payroll_run = payroll_service.create_run_with_items(
        db,
        run_data=run_data,
        items_data=items_data,
        user_id=admin.id
    )
    db.commit()
    db.refresh(payroll_run)
    
    # Reload with items
    payroll_run = payroll_service.get_run_with_items(db, payroll_run.id)
    return payroll_run


@router.post("/import", response_model=PayrollImportResult)
def import_payroll_csv(
    file: UploadFile = File(..., description="CSV file with payroll data"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Import payroll data from CSV file (admin only).
    
    Expected CSV format:
    - employee_id: UUID of the employee
    - gross_wages: Gross wage amount
    - payg_withheld: PAYG tax withheld
    - super_amount: Superannuation contribution
    - project_allocations: JSON array of {project_id, percentage}
    - notes: Optional notes
    
    Creates a new payroll run with the imported data.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    result = payroll_service.import_from_csv(db, file.file, admin.id)
    
    if result["success"]:
        db.commit()
    else:
        db.rollback()
    
    return PayrollImportResult(
        success=result["success"],
        run_id=result["run_id"],
        items_created=result["items_created"],
        errors=result["errors"]
    )


@router.get("/payg-summary", response_model=List[PaygMonthlySummary])
def get_payg_summary(
    year: int = Query(..., ge=2000, le=2100, description="Year for summary (YYYY)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get monthly PAYG summary for a given year.
    
    Returns aggregated monthly totals for gross wages, PAYG withheld,
    and superannuation contributions.
    """
    summaries = payroll_service.get_payg_summary(db, year)
    return summaries


@router.patch("/{run_id}/items/{item_id}", response_model=PayrollItemResponse)
def update_payroll_item_allocation(
    run_id: UUID,
    item_id: UUID,
    request: PayrollItemUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update a payroll item's project allocations (admin only).
    
    Allows updating the project allocations for a specific payroll item.
    """
    # Verify the run exists
    payroll_run = payroll_service.get_by_id(db, run_id)
    if not payroll_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found"
        )
    
    # Update the item
    if request.project_allocations is not None:
        item = payroll_service.update_item_allocation(
            db,
            item_id=item_id,
            project_allocations=request.project_allocations,
            user_id=admin.id
        )
    else:
        # Just fetch the item
        from sqlalchemy import select
        from app.models.payroll import PayrollItem
        stmt = select(PayrollItem).where(PayrollItem.id == item_id)
        result = db.execute(stmt)
        item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll item not found"
        )
    
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payroll_run(
    run_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Delete a payroll run and all its items (admin only).
    
    Performs a cascading delete of the payroll run and associated items.
    """
    payroll_run = payroll_service.get_by_id(db, run_id)
    if not payroll_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found"
        )
    
    payroll_service.delete(db, run_id, user_id=admin.id)
    db.commit()
    return None
