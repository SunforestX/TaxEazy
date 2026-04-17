import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.company import Company
from app.services.base import BaseService


class CompanyService(BaseService[Company]):
    """
    Service class for managing company data.
    
    This service handles the single company record in the system.
    Since there's only one company, methods work with the first (and only) record.
    """
    
    def __init__(self):
        super().__init__(Company, "company")
    
    def get_company(self, db: Session) -> Optional[Company]:
        """
        Get the single company record.
        
        Args:
            db: SQLAlchemy session
        
        Returns:
            The company instance or None if not found
        """
        stmt = select(Company).limit(1)
        result = db.execute(stmt)
        return result.scalar_one_or_none()
    
    def update_company(
        self,
        db: Session,
        update_data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Optional[Company]:
        """
        Update the company record.
        
        Args:
            db: SQLAlchemy session
            update_data: Dictionary of field names to new values
            user_id: Optional UUID of the updating user for audit
            ip_address: Optional IP address for audit
        
        Returns:
            The updated company instance or None if not found
        """
        company = self.get_company(db)
        if not company:
            return None
        
        return self.update(
            db=db,
            entity_id=company.id,
            data=update_data,
            user_id=user_id,
            ip_address=ip_address
        )


# Singleton instance
company_service = CompanyService()
