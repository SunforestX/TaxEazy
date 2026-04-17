import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_

from app.models.exception import Exception, ExceptionType, Severity, EntityType
from app.services.base import BaseService


class ExceptionService(BaseService[Exception]):
    """Service for managing data quality exceptions."""
    
    def __init__(self):
        super().__init__(Exception, "Exception")
    
    def get_list(
        self,
        db: Session,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get a filtered, paginated list of exceptions.
        
        Args:
            db: SQLAlchemy session
            filters: Optional dictionary with keys: exception_type, severity, is_resolved, entity_type
            page: Page number (1-indexed)
            page_size: Items per page
        
        Returns:
            Dict with items, total, page, page_size
        """
        from app.utils.pagination import paginate
        
        query = select(Exception)
        
        # Apply filters
        conditions = []
        if filters:
            if filters.get("exception_type") is not None:
                conditions.append(Exception.exception_type == filters["exception_type"])
            if filters.get("severity") is not None:
                conditions.append(Exception.severity == filters["severity"])
            if filters.get("is_resolved") is not None:
                conditions.append(Exception.is_resolved == filters["is_resolved"])
            if filters.get("entity_type") is not None:
                conditions.append(Exception.entity_type == filters["entity_type"])
        
        if conditions:
            query = query.where(and_(*conditions))
        
        # Order by created_at desc (newest first)
        query = query.order_by(Exception.created_at.desc())
        
        return paginate(db, query, page, page_size)
    
    def resolve(
        self,
        db: Session,
        exception_id: uuid.UUID,
        user_id: uuid.UUID,
        notes: Optional[str] = None
    ) -> Optional[Exception]:
        """
        Mark an exception as resolved.
        
        Args:
            db: SQLAlchemy session
            exception_id: UUID of the exception to resolve
            user_id: UUID of the user resolving the exception
            notes: Optional resolution notes (stored in message for now)
        
        Returns:
            The updated exception or None if not found
        """
        exception = self.get_by_id(db, exception_id)
        if not exception:
            return None
        
        exception.is_resolved = True
        exception.resolved_by = user_id
        exception.resolved_at = datetime.utcnow()
        
        return exception
    
    def get_summary(self, db: Session) -> Dict[str, Any]:
        """
        Get exception counts summary.
        
        Returns:
            Dict with total, by_type, by_severity, unresolved_count
        """
        # Total count
        total_stmt = select(func.count()).select_from(Exception)
        total = db.execute(total_stmt).scalar()
        
        # Unresolved count
        unresolved_stmt = select(func.count()).select_from(Exception).where(
            Exception.is_resolved == False
        )
        unresolved_count = db.execute(unresolved_stmt).scalar()
        
        # Count by type
        by_type_stmt = select(
            Exception.exception_type,
            func.count()
        ).group_by(Exception.exception_type)
        by_type_result = db.execute(by_type_stmt).all()
        by_type = {row[0].value: row[1] for row in by_type_result}
        
        # Count by severity
        by_severity_stmt = select(
            Exception.severity,
            func.count()
        ).group_by(Exception.severity)
        by_severity_result = db.execute(by_severity_stmt).all()
        by_severity = {row[0].value: row[1] for row in by_severity_result}
        
        return {
            "total": total,
            "by_type": by_type,
            "by_severity": by_severity,
            "unresolved_count": unresolved_count
        }
    
    def get_by_entity(
        self,
        db: Session,
        entity_type: EntityType,
        entity_id: uuid.UUID,
        include_resolved: bool = False
    ) -> List[Exception]:
        """
        Get exceptions for a specific entity.
        
        Args:
            db: SQLAlchemy session
            entity_type: Type of entity
            entity_id: UUID of the entity
            include_resolved: Whether to include resolved exceptions
        
        Returns:
            List of exceptions
        """
        query = select(Exception).where(
            and_(
                Exception.entity_type == entity_type,
                Exception.entity_id == entity_id
            )
        )
        
        if not include_resolved:
            query = query.where(Exception.is_resolved == False)
        
        result = db.execute(query)
        return list(result.scalars().all())


# Singleton instance
exception_service = ExceptionService()
