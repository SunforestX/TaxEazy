import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func

from app.models.transaction import Transaction, TransactionAllocation, RdRelevance
from app.models.supplier import Supplier, Category, GstTreatment
from app.models.project import Project
from app.services.base import BaseService
from app.utils.pagination import paginate
from app.schemas.transaction import TransactionFilter, BulkClassifyRequest


class TransactionService(BaseService[Transaction]):
    """Service class for transaction management operations."""
    
    def __init__(self):
        super().__init__(Transaction, "Transaction")
    
    def _apply_filters(self, query, filters: TransactionFilter):
        """Apply filters to a transaction query."""
        conditions = []
        
        if filters.date_from:
            conditions.append(Transaction.date >= filters.date_from)
        if filters.date_to:
            conditions.append(Transaction.date <= filters.date_to)
        if filters.category:
            conditions.append(Transaction.category == filters.category)
        if filters.gst_treatment:
            conditions.append(Transaction.gst_treatment == filters.gst_treatment)
        if filters.rd_relevance:
            conditions.append(Transaction.rd_relevance == filters.rd_relevance)
        if filters.supplier_id:
            conditions.append(Transaction.supplier_id == filters.supplier_id)
        if filters.min_amount:
            conditions.append(Transaction.amount >= filters.min_amount)
        if filters.max_amount:
            conditions.append(Transaction.amount <= filters.max_amount)
        if filters.has_project is not None:
            if filters.has_project:
                conditions.append(Transaction.project_id.isnot(None))
            else:
                conditions.append(Transaction.project_id.is_(None))
        if filters.search:
            search_pattern = f"%{filters.search}%"
            conditions.append(
                or_(
                    Transaction.description.ilike(search_pattern),
                    Transaction.reference.ilike(search_pattern)
                )
            )
        
        if conditions:
            query = query.where(and_(*conditions))
        
        return query
    
    def get_list(
        self,
        db: Session,
        filters: Optional[TransactionFilter] = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "date",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """
        Get a filtered, paginated, and sorted list of transactions with supplier names.
        
        Args:
            db: SQLAlchemy session
            filters: TransactionFilter instance with filter criteria
            page: Page number (1-indexed)
            page_size: Items per page
            sort_by: Column to sort by
            sort_order: Sort direction ('asc' or 'desc')
        
        Returns:
            Dict with items, total, page, page_size
        """
        # Build base query with supplier join
        query = select(Transaction, Supplier.name.label("supplier_name")).outerjoin(
            Supplier, Transaction.supplier_id == Supplier.id
        )
        
        # Apply filters
        if filters:
            query = self._apply_filters(query, filters)
        
        # Apply sorting
        sort_column = getattr(Transaction, sort_by, Transaction.date)
        if sort_order.lower() == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Paginate
        result = paginate(db, query, page, page_size)
        
        # Transform items to include supplier_name
        items = []
        for row in result["items"]:
            transaction = row[0] if isinstance(row, tuple) else row
            supplier_name = row[1] if isinstance(row, tuple) else None
            
            # Convert to dict-like structure with supplier_name
            transaction_dict = {
                "id": transaction.id,
                "date": transaction.date,
                "description": transaction.description,
                "amount": transaction.amount,
                "gst_amount": transaction.gst_amount,
                "account_code": transaction.account_code,
                "reference": transaction.reference,
                "supplier_id": transaction.supplier_id,
                "supplier_name": supplier_name,
                "category": transaction.category,
                "gst_treatment": transaction.gst_treatment,
                "rd_relevance": transaction.rd_relevance,
                "notes": transaction.notes,
                "is_reconciled": transaction.is_reconciled,
                "created_by": transaction.created_by,
                "created_at": transaction.created_at,
                "updated_at": transaction.updated_at,
                "allocations": []
            }
            items.append(transaction_dict)
        
        result["items"] = items
        return result
    
    def get_by_id_with_allocations(
        self,
        db: Session,
        transaction_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get a single transaction by ID with allocations and supplier name.
        
        Args:
            db: SQLAlchemy session
            transaction_id: UUID of the transaction
        
        Returns:
            Transaction dict with allocations or None if not found
        """
        query = select(Transaction, Supplier.name.label("supplier_name")).outerjoin(
            Supplier, Transaction.supplier_id == Supplier.id
        ).where(Transaction.id == transaction_id)
        
        result = db.execute(query).first()
        if not result:
            return None
        
        transaction = result[0]
        supplier_name = result[1]
        
        # Get allocations with project names
        allocations_query = select(
            TransactionAllocation,
            Project.name.label("project_name")
        ).outerjoin(
            Project, TransactionAllocation.project_id == Project.id
        ).where(TransactionAllocation.transaction_id == transaction_id)
        
        allocations_result = db.execute(allocations_query).all()
        allocations = []
        for alloc_row in allocations_result:
            allocation = alloc_row[0]
            project_name = alloc_row[1]
            allocations.append({
                "id": allocation.id,
                "project_id": allocation.project_id,
                "project_name": project_name,
                "percentage": allocation.percentage,
                "amount": allocation.amount
            })
        
        return {
            "id": transaction.id,
            "date": transaction.date,
            "description": transaction.description,
            "amount": transaction.amount,
            "gst_amount": transaction.gst_amount,
            "account_code": transaction.account_code,
            "reference": transaction.reference,
            "supplier_id": transaction.supplier_id,
            "supplier_name": supplier_name,
            "category": transaction.category,
            "gst_treatment": transaction.gst_treatment,
            "rd_relevance": transaction.rd_relevance,
            "notes": transaction.notes,
            "is_reconciled": transaction.is_reconciled,
            "created_by": transaction.created_by,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
            "allocations": allocations
        }
    
    def create(
        self,
        db: Session,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Transaction:
        """
        Create a new transaction with optional initial allocation.
        
        Args:
            db: SQLAlchemy session
            data: Dictionary of field names to values
            user_id: Optional UUID of the creating user
            ip_address: Optional IP address for audit
        
        Returns:
            The created transaction instance
        """
        # Extract allocation data if present
        project_id = data.pop("project_id", None)
        allocation_percentage = data.pop("allocation_percentage", None)
        
        # Set created_by
        if user_id:
            data["created_by"] = user_id
        
        transaction = super().create(db, data, user_id, ip_address)
        
        # Create initial allocation if provided
        if project_id and allocation_percentage:
            allocation_amount = (transaction.amount * allocation_percentage) / Decimal("100")
            allocation = TransactionAllocation(
                transaction_id=transaction.id,
                project_id=project_id,
                percentage=allocation_percentage,
                amount=allocation_amount
            )
            db.add(allocation)
            db.flush()
        
        return transaction
    
    def update(
        self,
        db: Session,
        entity_id: uuid.UUID,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> Optional[Transaction]:
        """
        Update an existing transaction with audit logging.
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the transaction to update
            data: Dictionary of field names to new values
            user_id: Optional UUID of the updating user
            ip_address: Optional IP address for audit
        
        Returns:
            The updated transaction instance or None if not found
        """
        # Handle allocation updates separately
        project_id = data.pop("project_id", None)
        allocation_percentage = data.pop("allocation_percentage", None)
        
        transaction = super().update(db, entity_id, data, user_id, ip_address)
        
        if transaction and project_id and allocation_percentage:
            self.allocate_to_project(db, entity_id, project_id, allocation_percentage, user_id)
        
        return transaction
    
    def delete(
        self,
        db: Session,
        entity_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        Soft delete a transaction (set is_reconciled as marker, actual delete).
        
        Args:
            db: SQLAlchemy session
            entity_id: UUID of the transaction to delete
            user_id: Optional UUID of the deleting user
            ip_address: Optional IP address for audit
        
        Returns:
            True if deleted, False if not found
        """
        # Perform hard delete (cascade will handle allocations)
        return super().delete(db, entity_id, user_id, ip_address, soft_delete=False)
    
    def bulk_classify(
        self,
        db: Session,
        request: BulkClassifyRequest,
        user_id: Optional[uuid.UUID] = None
    ) -> Dict[str, Any]:
        """
        Update classification fields for multiple transactions.
        
        Args:
            db: SQLAlchemy session
            request: BulkClassifyRequest with transaction IDs and new values
            user_id: Optional UUID of the updating user
        
        Returns:
            Dict with updated_count and errors
        """
        updated_count = 0
        errors = []
        
        for transaction_id in request.transaction_ids:
            try:
                update_data = {}
                if request.category is not None:
                    update_data["category"] = request.category
                if request.gst_treatment is not None:
                    update_data["gst_treatment"] = request.gst_treatment
                if request.rd_relevance is not None:
                    update_data["rd_relevance"] = request.rd_relevance
                
                transaction = self.update(db, transaction_id, update_data, user_id)
                if transaction:
                    updated_count += 1
                    
                    # Handle project allocation if specified
                    if request.project_id:
                        self.allocate_to_project(
                            db, transaction_id, request.project_id, Decimal("100"), user_id
                        )
                else:
                    errors.append({"id": str(transaction_id), "error": "Transaction not found"})
            except Exception as e:
                errors.append({"id": str(transaction_id), "error": str(e)})
        
        return {"updated_count": updated_count, "errors": errors}
    
    def get_summary(
        self,
        db: Session,
        filters: Optional[TransactionFilter] = None
    ) -> Dict[str, Any]:
        """
        Get aggregated totals by category, GST treatment, and RD relevance.
        
        Args:
            db: SQLAlchemy session
            filters: Optional TransactionFilter to apply
        
        Returns:
            Dict with total_count, total_amount, by_category, by_gst_treatment, by_rd_relevance
        """
        query = select(Transaction)
        
        if filters:
            query = self._apply_filters(query, filters)
        
        # Get all matching transactions for aggregation
        result = db.execute(query)
        transactions = result.scalars().all()
        
        total_count = len(transactions)
        total_amount = sum(t.amount for t in transactions)
        total_gst = sum(t.gst_amount or Decimal("0") for t in transactions)
        
        # Calculate R&D eligible amount (YES or PARTIAL)
        rd_eligible_amount = sum(
            t.amount for t in transactions 
            if t.rd_relevance in (RdRelevance.YES, RdRelevance.PARTIAL)
        )
        
        # Aggregations by category
        by_category = {}
        for t in transactions:
            cat = t.category.value if t.category else "Uncategorized"
            by_category[cat] = by_category.get(cat, Decimal("0")) + t.amount
        
        # Aggregations by GST treatment
        by_gst_treatment = {}
        for t in transactions:
            gst = t.gst_treatment.value if t.gst_treatment else "Unspecified"
            by_gst_treatment[gst] = by_gst_treatment.get(gst, Decimal("0")) + t.amount
        
        # Aggregations by RD relevance
        by_rd_relevance = {}
        for t in transactions:
            rd = t.rd_relevance.value if t.rd_relevance else "no"
            by_rd_relevance[rd] = by_rd_relevance.get(rd, Decimal("0")) + t.amount
        
        return {
            "total_count": total_count,
            "total_amount": total_amount,
            "total_gst_amount": total_gst,
            "rd_eligible_amount": rd_eligible_amount,
            "by_category": by_category,
            "by_gst_treatment": by_gst_treatment,
            "by_rd_relevance": by_rd_relevance
        }
    
    def allocate_to_project(
        self,
        db: Session,
        transaction_id: uuid.UUID,
        project_id: uuid.UUID,
        percentage: Decimal,
        user_id: Optional[uuid.UUID] = None
    ) -> TransactionAllocation:
        """
        Create or update a transaction allocation to a project.
        
        Args:
            db: SQLAlchemy session
            transaction_id: UUID of the transaction
            project_id: UUID of the project
            percentage: Allocation percentage (0-100)
            user_id: Optional UUID of the user making the allocation
        
        Returns:
            The created or updated TransactionAllocation
        """
        # Get transaction to calculate amount
        transaction = self.get_by_id(db, transaction_id)
        if not transaction:
            raise ValueError("Transaction not found")
        
        # Check for existing allocation to this project
        existing_query = select(TransactionAllocation).where(
            and_(
                TransactionAllocation.transaction_id == transaction_id,
                TransactionAllocation.project_id == project_id
            )
        )
        existing = db.execute(existing_query).scalar_one_or_none()
        
        allocation_amount = (transaction.amount * percentage) / Decimal("100")
        
        if existing:
            existing.percentage = percentage
            existing.amount = allocation_amount
            db.flush()
            return existing
        else:
            allocation = TransactionAllocation(
                transaction_id=transaction_id,
                project_id=project_id,
                percentage=percentage,
                amount=allocation_amount
            )
            db.add(allocation)
            db.flush()
            return allocation


# Create a singleton instance
transaction_service = TransactionService()
