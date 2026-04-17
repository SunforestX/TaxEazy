import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.services.base import BaseService
from app.models.employee import Employee


class EmployeeService(BaseService[Employee]):
    """
    Service class for Employee entity operations.
    
    Extends BaseService to provide CRUD operations for Employee model
    with additional business logic for employee management.
    """
    
    def __init__(self):
        super().__init__(Employee, "Employee")
    
    def get_by_email(self, db: Session, email: str) -> Optional[Employee]:
        """
        Get an employee by their email address.
        
        Args:
            db: SQLAlchemy session
            email: Employee email address
            
        Returns:
            Employee instance or None if not found
        """
        stmt = select(Employee).where(Employee.email == email)
        result = db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_active_employees(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get paginated list of active employees.
        
        Args:
            db: SQLAlchemy session
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with items, total, page, page_size
        """
        return self.get_list(db, page=page, page_size=page_size, filters={"is_active": True})
    
    def get_scientists(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get paginated list of scientist employees.
        
        Args:
            db: SQLAlchemy session
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with items, total, page, page_size
        """
        return self.get_list(db, page=page, page_size=page_size, filters={"is_scientist": True})
    
    def search_employees(
        self,
        db: Session,
        query: str,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Search employees by name or email.
        
        Args:
            db: SQLAlchemy session
            query: Search query string
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with items, total, page, page_size
        """
        from sqlalchemy import or_
        from app.utils.pagination import paginate
        
        search_pattern = f"%{query}%"
        stmt = select(Employee).where(
            or_(
                Employee.name.ilike(search_pattern),
                Employee.email.ilike(search_pattern)
            )
        )
        
        return paginate(db, stmt, page, page_size)


# Singleton instance
employee_service = EmployeeService()
