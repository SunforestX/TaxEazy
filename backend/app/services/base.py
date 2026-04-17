import uuid
from typing import TypeVar, Type, Optional, List, Dict, Any, Generic
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from sqlalchemy.orm import Query

from app.utils.audit import log_audit_event, log_create, log_update, log_delete
from app.utils.pagination import paginate, PaginationParams
from app.models.audit_event import ActionType

ModelType = TypeVar('ModelType')


class BaseService(Generic[ModelType]):
    """
    Generic base CRUD service class that all domain services inherit from.
    
    Provides standard CRUD operations with automatic audit logging and pagination support.
    All models are expected to have an 'id' column of type UUID.
    """
    
    def __init__(self, model: Type[ModelType], entity_name: str):
        """
        Initialize the service with a model class and entity name.
        
        Args:
            model: The SQLAlchemy model class
            entity_name: Human-readable name for the entity (used in audit logs)
        """
        self.model = model
        self.entity_name = entity_name
    
    def get_by_id(self, db: Session, entity_id: uuid.UUID) -> Optional[ModelType]:
        """
        Get a single entity by its ID.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the entity
        
        Returns:
            The entity instance or None if not found
        """
        stmt = select(self.model).where(self.model.id == entity_id)
        result = db.execute(stmt)
        return result.scalar_one_or_none()
    
    def get_list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Get a paginated list of entities with optional filtering.
        
        Args:
            db: SQLAlchemy session
            page: Page number (1-indexed, default 1)
            page_size: Items per page (default 20, max 100)
            filters: Optional dictionary of column names to filter values
        
        Returns:
            Dict with items, total, page, page_size
        """
        query = select(self.model)
        
        # Apply filters if provided
        if filters:
            conditions = []
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    column = getattr(self.model, key)
                    conditions.append(column == value)
            
            if conditions:
                query = query.where(and_(*conditions))
        
        return paginate(db, query, page, page_size)
    
    def create(
        self,
        db: Session,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> ModelType:
        """
        Create a new entity.
        
        Args:
            db: SQLAlchemy session
            data: Dictionary of field names to values
            user_id: Optional UUID of the creating user for audit
            ip_address: Optional IP address for audit
        
        Returns:
            The created entity instance
        """
        entity = self.model(**data)
        db.add(entity)
        db.flush()  # Flush to get the ID without committing
        
        # Log the create action
        log_create(
            db=db,
            user_id=user_id,
            entity_type=self.entity_name,
            entity_id=entity.id,
            new_values=data,
            ip_address=ip_address
        )
        
        return entity
    
    def update(
        self,
        db: Session,
        entity_id: uuid.UUID,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Optional[ModelType]:
        """
        Update an existing entity.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the entity to update
            data: Dictionary of field names to new values
            user_id: Optional UUID of the updating user for audit
            ip_address: Optional IP address for audit
        
        Returns:
            The updated entity instance or None if not found
        """
        entity = self.get_by_id(db, entity_id)
        if not entity:
            return None
        
        # Capture old values for audit
        old_values = {}
        new_values = {}
        
        for key, value in data.items():
            if hasattr(entity, key):
                old_val = getattr(entity, key)
                if old_val != value:
                    old_values[key] = old_val
                    new_values[key] = value
                    setattr(entity, key, value)
        
        # Only log if there were actual changes
        if old_values:
            log_update(
                db=db,
                user_id=user_id,
                entity_type=self.entity_name,
                entity_id=entity_id,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip_address
            )
        
        return entity
    
    def delete(
        self,
        db: Session,
        entity_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        soft_delete: bool = False,
        deleted_at_attr: str = "deleted_at"
    ) -> bool:
        """
        Delete an entity (hard delete by default, soft delete optional).
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the entity to delete
            user_id: Optional UUID of the deleting user for audit
            ip_address: Optional IP address for audit
            soft_delete: If True, performs a soft delete by setting deleted_at
            deleted_at_attr: Name of the deleted_at attribute for soft delete
        
        Returns:
            True if deleted, False if entity not found
        """
        entity = self.get_by_id(db, entity_id)
        if not entity:
            return False
        
        # Capture old values for audit
        old_values = {column.name: getattr(entity, column.name) 
                     for column in entity.__table__.columns}
        
        if soft_delete and hasattr(entity, deleted_at_attr):
            from datetime import datetime
            setattr(entity, deleted_at_attr, datetime.utcnow())
            action = ActionType.STATUS_CHANGE
        else:
            db.delete(entity)
            action = ActionType.DELETE
        
        # Log the delete action
        log_audit_event(
            db=db,
            user_id=user_id,
            action=action,
            entity_type=self.entity_name,
            entity_id=entity_id,
            old_values=old_values,
            ip_address=ip_address
        )
        
        return True
    
    def exists(self, db: Session, entity_id: uuid.UUID) -> bool:
        """
        Check if an entity exists by ID.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the entity
        
        Returns:
            True if exists, False otherwise
        """
        stmt = select(self.model.id).where(self.model.id == entity_id)
        result = db.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    def count(self, db: Session, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count entities with optional filtering.
        
        Args:
            db: SQLAlchemy session
            filters: Optional dictionary of column names to filter values
        
        Returns:
            Count of matching entities
        """
        from sqlalchemy import func
        
        query = select(func.count()).select_from(self.model)
        
        if filters:
            conditions = []
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    column = getattr(self.model, key)
                    conditions.append(column == value)
            
            if conditions:
                query = query.where(and_(*conditions))
        
        result = db.execute(query)
        return result.scalar()
