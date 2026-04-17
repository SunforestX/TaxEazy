import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, func

from app.models.supplier import Supplier
from app.services.base import BaseService


class SupplierService(BaseService[Supplier]):
    """Service class for supplier management operations."""
    
    def __init__(self):
        super().__init__(Supplier, "Supplier")
    
    def _build_contact_info(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build contact_info JSON from individual contact fields.
        
        Args:
            data: Dictionary that may contain contact_name, contact_email, phone, address
            
        Returns:
            Dictionary with contact_info key added
        """
        contact_info = {}
        if "contact_name" in data and data["contact_name"] is not None:
            contact_info["contact_name"] = data.pop("contact_name")
        if "contact_email" in data and data["contact_email"] is not None:
            contact_info["contact_email"] = data.pop("contact_email")
        if "phone" in data and data["phone"] is not None:
            contact_info["phone"] = data.pop("phone")
        if "address" in data and data["address"] is not None:
            contact_info["address"] = data.pop("address")
        
        if contact_info:
            data["contact_info"] = contact_info
        
        return data
    
    def _extract_contact_fields(self, supplier: Supplier) -> Dict[str, Any]:
        """
        Extract individual contact fields from supplier's contact_info JSON.
        
        Args:
            supplier: Supplier model instance
            
        Returns:
            Dictionary with flattened contact fields
        """
        contact_info = supplier.contact_info or {}
        return {
            "contact_name": contact_info.get("contact_name"),
            "contact_email": contact_info.get("contact_email"),
            "phone": contact_info.get("phone"),
            "address": contact_info.get("address"),
        }
    
    def create(
        self,
        db: Session,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Supplier:
        """
        Create a new supplier with contact_info handling.
        
        Args:
            db: SQLAlchemy session
            data: Dictionary of field names to values
            user_id: Optional UUID of the creating user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            The created supplier instance
        """
        data = self._build_contact_info(data.copy())
        return super().create(db, data, user_id, ip_address)
    
    def update(
        self,
        db: Session,
        entity_id: uuid.UUID,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Optional[Supplier]:
        """
        Update an existing supplier with contact_info handling.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the supplier to update
            data: Dictionary of field names to new values
            user_id: Optional UUID of the updating user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            The updated supplier instance or None if not found
        """
        data = self._build_contact_info(data.copy())
        return super().update(db, entity_id, data, user_id, ip_address)
    
    def search_by_name_or_abn(
        self,
        db: Session,
        search_term: str,
        page: int = 1,
        page_size: int = 20,
        include_inactive: bool = False
    ) -> Dict[str, Any]:
        """
        Search suppliers by name or ABN.
        
        Args:
            db: SQLAlchemy session
            search_term: Search string to match against name or ABN
            page: Page number (1-indexed, default 1)
            page_size: Items per page (default 20, max 100)
            include_inactive: Whether to include inactive suppliers
            
        Returns:
            Dict with items, total, page, page_size
        """
        from app.utils.pagination import paginate
        
        query = select(Supplier)
        
        # Build search conditions
        search_pattern = f"%{search_term}%"
        conditions = [
            Supplier.name.ilike(search_pattern),
            Supplier.abn.ilike(search_pattern)
        ]
        query = query.where(or_(*conditions))
        
        # Filter active suppliers unless requested otherwise
        if not include_inactive:
            query = query.where(Supplier.is_active == True)
        
        return paginate(db, query, page, page_size)
    
    def get_list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get a paginated list of suppliers with optional filtering and search.
        
        Args:
            db: SQLAlchemy session
            page: Page number (1-indexed, default 1)
            page_size: Items per page (default 20, max 100)
            filters: Optional dictionary of column names to filter values
            search: Optional search term for name/ABN
            
        Returns:
            Dict with items, total, page, page_size
        """
        if search:
            include_inactive = filters.get("is_active") is False if filters else False
            return self.search_by_name_or_abn(db, search, page, page_size, include_inactive)
        
        return super().get_list(db, page, page_size, filters)
    
    def soft_delete(
        self,
        db: Session,
        entity_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        Soft delete a supplier by setting is_active to False.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the supplier to delete
            user_id: Optional UUID of the deleting user for audit
            ip_address: Optional IP address for audit
            
        Returns:
            True if deleted, False if supplier not found
        """
        return self.update(
            db=db,
            entity_id=entity_id,
            data={"is_active": False},
            user_id=user_id,
            ip_address=ip_address
        ) is not None


# Create a singleton instance
supplier_service = SupplierService()
