from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.services.company import company_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/company", tags=["Company"])


@router.get("/", response_model=CompanyResponse)
def get_company(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get company details.
    
    Requires authentication.
    """
    company = company_service.get_company(db)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    return company


@router.patch("/", response_model=CompanyResponse)
def update_company(
    update_data: CompanyUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Update company details.
    
    Requires admin access.
    """
    company = company_service.get_company(db)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    # Filter out None values
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if not update_dict:
        return company
    
    updated_company = company_service.update_company(
        db=db,
        update_data=update_dict,
        user_id=admin.id
    )
    
    if not updated_company:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update company"
        )
    
    db.commit()
    db.refresh(updated_company)
    
    return updated_company
