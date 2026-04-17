import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func

from app.models.bas_period import BasPeriod, BasStatus
from app.models.transaction import Transaction
from app.models.supplier import Supplier, GstTreatment
from app.services.base import BaseService
from app.utils.pagination import paginate
from app.utils.audit import log_audit_event
from app.models.audit_event import ActionType


class BasService(BaseService[BasPeriod]):
    """Service class for BAS period management and GST calculations."""
    
    def __init__(self):
        super().__init__(BasPeriod, "BasPeriod")
    
    def create_period(
        self,
        db: Session,
        start_date: date,
        end_date: date,
        user_id: Optional[uuid.UUID] = None
    ) -> BasPeriod:
        """
        Create a new BAS period.
        
        Args:
            db: SQLAlchemy session
            start_date: Period start date
            end_date: Period end date
            user_id: Optional UUID of the creating user
        
        Returns:
            The created BasPeriod instance
        """
        data = {
            "period_start": start_date,
            "period_end": end_date,
            "status": BasStatus.DRAFT,
            "gst_collected": Decimal("0"),
            "gst_paid": Decimal("0"),
            "net_gst_position": Decimal("0")
        }
        
        period = super().create(db, data, user_id)
        return period
    
    def get_period_with_summary(
        self,
        db: Session,
        period_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get a BAS period with calculated GST summary.
        
        Args:
            db: SQLAlchemy session
            period_id: UUID of the period
        
        Returns:
            Dict with period and summary, or None if not found
        """
        period = self.get_by_id(db, period_id)
        if not period:
            return None
        
        # Calculate summary from transactions
        summary = self.calculate_gst_summary(db, period.period_start, period.period_end)
        
        return {
            "period": period,
            "summary": summary
        }
    
    def calculate_gst_summary(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Calculate GST summary for a date range.
        
        GST Collected = sum of gst_amount on transactions where amount > 0 (sales/income)
                        AND gst_treatment in (CAP, EXP - GST applicable)
        GST Paid = sum of gst_amount on transactions where amount < 0 (purchases/expenses)
                   AND gst_treatment in (CAP, EXP - GST applicable)
        Net GST = GST Collected - abs(GST Paid)
        
        Args:
            db: SQLAlchemy session
            start_date: Start date for calculation
            end_date: End date for calculation
        
        Returns:
            Dict with gst_collected, gst_paid, net_gst, total_sales, total_purchases,
            transaction_count, unresolved_count
        """
        # Get all transactions in the date range
        query = select(Transaction).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date <= end_date
            )
        )
        result = db.execute(query)
        transactions = result.scalars().all()
        
        # GST-applicable treatments
        gst_applicable = (GstTreatment.CAP, GstTreatment.EXP)
        
        gst_collected = Decimal("0")  # From sales (positive amounts)
        gst_paid = Decimal("0")       # From purchases (negative amounts)
        total_sales = Decimal("0")    # Sum of positive amounts
        total_purchases = Decimal("0")  # Sum of negative amounts (absolute)
        unresolved_count = 0
        
        for t in transactions:
            # Check for unresolved GST treatment
            if t.gst_treatment is None or t.gst_treatment == GstTreatment.MIX:
                unresolved_count += 1
            
            # Categorize by amount direction
            if t.amount > 0:
                # Sales/Income
                total_sales += t.amount
                if t.gst_treatment in gst_applicable and t.gst_amount:
                    gst_collected += t.gst_amount
            elif t.amount < 0:
                # Purchases/Expenses
                total_purchases += abs(t.amount)
                if t.gst_treatment in gst_applicable and t.gst_amount:
                    gst_paid += t.gst_amount
        
        # Net GST position (positive = payable, negative = refundable)
        net_gst = gst_collected - gst_paid
        
        return {
            "gst_collected": gst_collected,
            "gst_paid": gst_paid,
            "net_gst": net_gst,
            "total_sales": total_sales,
            "total_purchases": total_purchases,
            "transaction_count": len(transactions),
            "unresolved_count": unresolved_count
        }
    
    def get_period_transactions(
        self,
        db: Session,
        period_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20
    ) -> Optional[Dict[str, Any]]:
        """
        Get paginated transactions within a BAS period date range.
        
        Args:
            db: SQLAlchemy session
            period_id: UUID of the period
            page: Page number (1-indexed)
            page_size: Items per page
        
        Returns:
            Paginated result with transaction items, or None if period not found
        """
        period = self.get_by_id(db, period_id)
        if not period:
            return None
        
        # Build query with supplier join
        query = select(
            Transaction,
            Supplier.name.label("supplier_name")
        ).outerjoin(
            Supplier, Transaction.supplier_id == Supplier.id
        ).where(
            and_(
                Transaction.date >= period.period_start,
                Transaction.date <= period.period_end
            )
        ).order_by(Transaction.date.desc())
        
        result = paginate(db, query, page, page_size)
        
        # Transform items
        items = []
        for row in result["items"]:
            transaction = row[0] if isinstance(row, tuple) else row
            supplier_name = row[1] if isinstance(row, tuple) else None
            
            items.append({
                "id": transaction.id,
                "date": transaction.date,
                "description": transaction.description,
                "amount": transaction.amount,
                "gst_amount": transaction.gst_amount,
                "gst_treatment": transaction.gst_treatment.value if transaction.gst_treatment else None,
                "category": transaction.category.value if transaction.category else None,
                "supplier_name": supplier_name,
                "reference": getattr(transaction, 'reference', None)
            })
        
        result["items"] = items
        return result
    
    def get_unresolved(
        self,
        db: Session,
        period_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20
    ) -> Optional[Dict[str, Any]]:
        """
        Get transactions with missing or ambiguous GST treatment.
        
        Args:
            db: SQLAlchemy session
            period_id: UUID of the period
            page: Page number (1-indexed)
            page_size: Items per page
        
        Returns:
            Paginated result with unresolved transactions, or None if period not found
        """
        period = self.get_by_id(db, period_id)
        if not period:
            return None
        
        # Build query for unresolved transactions
        query = select(
            Transaction,
            Supplier.name.label("supplier_name")
        ).outerjoin(
            Supplier, Transaction.supplier_id == Supplier.id
        ).where(
            and_(
                Transaction.date >= period.period_start,
                Transaction.date <= period.period_end,
                or_(
                    Transaction.gst_treatment.is_(None),
                    Transaction.gst_treatment == GstTreatment.MIX
                )
            )
        ).order_by(Transaction.date.desc())
        
        result = paginate(db, query, page, page_size)
        
        # Transform items
        items = []
        for row in result["items"]:
            transaction = row[0] if isinstance(row, tuple) else row
            supplier_name = row[1] if isinstance(row, tuple) else None
            
            items.append({
                "id": transaction.id,
                "date": transaction.date,
                "description": transaction.description,
                "amount": transaction.amount,
                "gst_amount": transaction.gst_amount,
                "gst_treatment": transaction.gst_treatment.value if transaction.gst_treatment else None,
                "category": transaction.category.value if transaction.category else None,
                "supplier_name": supplier_name,
                "reference": getattr(transaction, 'reference', None)
            })
        
        result["items"] = items
        return result
    
    def finalize_period(
        self,
        db: Session,
        period_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None
    ) -> Optional[BasPeriod]:
        """
        Mark a BAS period as FINALISED and store calculated values.
        
        Args:
            db: SQLAlchemy session
            period_id: UUID of the period to finalize
            user_id: Optional UUID of the finalizing user
        
        Returns:
            The updated BasPeriod instance or None if not found
        """
        period = self.get_by_id(db, period_id)
        if not period:
            return None
        
        # Calculate current summary
        summary = self.calculate_gst_summary(db, period.period_start, period.period_end)
        
        # Update period with calculated values
        update_data = {
            "status": BasStatus.FINALISED,
            "gst_collected": summary["gst_collected"],
            "gst_paid": summary["gst_paid"],
            "net_gst_position": summary["net_gst"],
            "finalised_at": datetime.utcnow()
        }
        
        # Use base update for audit logging
        updated_period = super().update(db, period_id, update_data, user_id)
        
        # Log status change specifically
        log_audit_event(
            db=db,
            user_id=user_id,
            action=ActionType.STATUS_CHANGE,
            entity_type="BasPeriod",
            entity_id=period_id,
            old_values={"status": BasStatus.DRAFT.value},
            new_values={
                "status": BasStatus.FINALISED.value,
                "gst_collected": str(summary["gst_collected"]),
                "gst_paid": str(summary["gst_paid"]),
                "net_gst_position": str(summary["net_gst"])
            }
        )
        
        return updated_period
    
    def export_period(
        self,
        db: Session,
        period_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Generate export-ready data for a BAS period.
        
        Args:
            db: SQLAlchemy session
            period_id: UUID of the period
        
        Returns:
            Dict with structured export data, or None if period not found
        """
        period = self.get_by_id(db, period_id)
        if not period:
            return None
        
        # Get summary
        summary = self.calculate_gst_summary(db, period.period_start, period.period_end)
        
        # Use stored values if finalized, otherwise use calculated
        if period.status == BasStatus.FINALISED:
            gst_collected = period.gst_collected
            gst_paid = period.gst_paid
            net_gst = period.net_gst_position
        else:
            gst_collected = summary["gst_collected"]
            gst_paid = summary["gst_paid"]
            net_gst = summary["net_gst"]
        
        return {
            "period_id": period.id,
            "period_start": period.period_start,
            "period_end": period.period_end,
            "status": period.status.value,
            "generated_at": datetime.utcnow(),
            "summary": summary,
            "gst_collected": gst_collected,
            "gst_paid": gst_paid,
            "net_gst": net_gst,
            "total_sales": summary["total_sales"],
            "total_purchases": summary["total_purchases"]
        }
    
    def list_periods(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        List all BAS periods, newest first.
        
        Args:
            db: SQLAlchemy session
            page: Page number (1-indexed)
            page_size: Items per page
        
        Returns:
            Dict with items, total, page, page_size
        """
        query = select(BasPeriod).order_by(BasPeriod.period_start.desc())
        return paginate(db, query, page, page_size)


# Create a singleton instance
bas_service = BasService()
