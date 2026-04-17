import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.services.base import BaseService
from app.models.rd_activity import RdActivity
from app.utils.pagination import paginate


class RdActivityService(BaseService[RdActivity]):
    """Service for managing R&D Activities scoped to a project."""
    
    def __init__(self):
        super().__init__(RdActivity, "RdActivity")
    
    def get_by_id_scoped(
        self,
        db: Session,
        project_id: uuid.UUID,
        activity_id: uuid.UUID
    ) -> Optional[RdActivity]:
        """
        Get an activity by ID ensuring it belongs to the specified project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            activity_id: UUID of the activity
            
        Returns:
            The activity instance or None if not found or not in project
        """
        stmt = select(RdActivity).where(
            and_(
                RdActivity.id == activity_id,
                RdActivity.project_id == project_id
            )
        )
        result = db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_list_by_project(
        self,
        db: Session,
        project_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get paginated list of activities for a specific project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with items, total, page, page_size
        """
        query = select(RdActivity).where(RdActivity.project_id == project_id)
        query = query.order_by(RdActivity.activity_date.desc())
        
        return paginate(db, query, page, page_size)
    
    def create_for_project(
        self,
        db: Session,
        project_id: uuid.UUID,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> RdActivity:
        """
        Create a new activity for a specific project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            data: Dictionary of field names to values
            user_id: Optional UUID of the creating user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            The created activity instance
        """
        data["project_id"] = project_id
        return self.create(db, data, user_id, ip_address)
    
    def update_for_project(
        self,
        db: Session,
        project_id: uuid.UUID,
        activity_id: uuid.UUID,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Optional[RdActivity]:
        """
        Update an activity ensuring it belongs to the specified project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            activity_id: UUID of the activity to update
            data: Dictionary of field names to new values
            user_id: Optional UUID of the updating user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            The updated activity instance or None if not found
        """
        activity = self.get_by_id_scoped(db, project_id, activity_id)
        if not activity:
            return None
        
        return self.update(db, activity_id, data, user_id, ip_address)
    
    def delete_for_project(
        self,
        db: Session,
        project_id: uuid.UUID,
        activity_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        Delete an activity ensuring it belongs to the specified project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            activity_id: UUID of the activity to delete
            user_id: Optional UUID of the deleting user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            True if deleted, False if not found
        """
        activity = self.get_by_id_scoped(db, project_id, activity_id)
        if not activity:
            return False
        
        return self.delete(db, activity_id, user_id, ip_address)
    
    def count_by_project(self, db: Session, project_id: uuid.UUID) -> int:
        """
        Count activities for a specific project.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            
        Returns:
            Count of activities
        """
        return self.count(db, {"project_id": project_id})


# Service instance
rd_activity_service = RdActivityService()
