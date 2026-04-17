import uuid
from decimal import Decimal
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_

from app.services.base import BaseService
from app.models.project import Project, ProjectStatus
from app.models.rd_activity import RdActivity
from app.models.transaction import TransactionAllocation
from app.models.payroll import PayrollItem
from app.models.evidence_file import EvidenceFile, LinkedType
from app.utils.pagination import paginate


class ProjectService(BaseService[Project]):
    """Service for managing R&D Projects with aggregated statistics."""
    
    def __init__(self):
        super().__init__(Project, "Project")
    
    def get_detail(self, db: Session, project_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Get project with activities count, spend summary, and evidence status.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            
        Returns:
            Dict with project data and aggregated statistics
        """
        project = self.get_by_id(db, project_id)
        if not project:
            return None
        
        activities_count = self._get_activities_count(db, project_id)
        total_spend = self._get_total_spend(db, project_id)
        evidence_status = self.get_evidence_status(db, project_id)
        
        return {
            "id": project.id,
            "code": project.code,
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "budget": project.budget,
            "scientific_rationale": project.scientific_rationale,
            "eligibility_notes": project.eligibility_notes,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "activities_count": activities_count,
            "total_spend": total_spend,
            "evidence_status": evidence_status
        }
    
    def _get_activities_count(self, db: Session, project_id: uuid.UUID) -> int:
        """Get count of activities for a project."""
        stmt = select(func.count()).select_from(RdActivity).where(RdActivity.project_id == project_id)
        return db.execute(stmt).scalar() or 0
    
    def _get_total_spend(self, db: Session, project_id: uuid.UUID) -> Decimal:
        """Get total spend for a project from transactions and payroll."""
        # Get transaction allocations
        stmt = select(func.sum(TransactionAllocation.amount)).where(
            TransactionAllocation.project_id == project_id
        )
        transaction_total = db.execute(stmt).scalar() or Decimal('0')
        
        # Get payroll allocations - need to parse JSON
        stmt = select(PayrollItem).where(
            PayrollItem.project_allocations.isnot(None)
        )
        payroll_items = db.execute(stmt).scalars().all()
        
        payroll_total = Decimal('0')
        for item in payroll_items:
            allocations = item.project_allocations or []
            for alloc in allocations:
                if alloc.get('project_id') == str(project_id):
                    percentage = Decimal(str(alloc.get('percentage', 0)))
                    amount = (item.gross_wages * percentage) / Decimal('100')
                    payroll_total += amount
        
        return transaction_total + payroll_total
    
    def get_spend_summary(self, db: Session, project_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Get spend breakdown by category: salaries, CRO/contractor, consumables, equipment, other.
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            
        Returns:
            Dict with spend breakdown by category
        """
        project = self.get_by_id(db, project_id)
        if not project:
            return None
        
        # Initialize categories
        categories = {
            "salaries": Decimal('0'),
            "cro_contractor": Decimal('0'),
            "consumables": Decimal('0'),
            "equipment": Decimal('0'),
            "other": Decimal('0')
        }
        
        # Get transaction allocations with category info
        from app.models.transaction import Transaction
        from app.models.supplier import Category
        
        stmt = select(TransactionAllocation, Transaction).join(
            Transaction, TransactionAllocation.transaction_id == Transaction.id
        ).where(TransactionAllocation.project_id == project_id)
        
        results = db.execute(stmt).all()
        
        for alloc, transaction in results:
            category = transaction.category
            if category == Category.SCIENTIFIC:
                categories["consumables"] += alloc.amount
            elif category == Category.EQUIPMENT:
                categories["equipment"] += alloc.amount
            elif category == Category.EXTERNAL_R_AND_D:
                categories["cro_contractor"] += alloc.amount
            elif category == Category.SALARIES:
                categories["salaries"] += alloc.amount
            else:
                categories["other"] += alloc.amount
        
        # Get payroll allocations
        stmt = select(PayrollItem).where(
            PayrollItem.project_allocations.isnot(None)
        )
        payroll_items = db.execute(stmt).scalars().all()
        
        for item in payroll_items:
            allocations = item.project_allocations or []
            for alloc in allocations:
                if alloc.get('project_id') == str(project_id):
                    percentage = Decimal(str(alloc.get('percentage', 0)))
                    amount = (item.gross_wages * percentage) / Decimal('100')
                    categories["salaries"] += amount
        
        total = sum(categories.values())
        
        return {
            "project_id": project_id,
            "categories": {k: float(v) for k, v in categories.items()},
            "total": float(total)
        }
    
    def get_evidence_status(self, db: Session, project_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Check evidence completeness for a project.
        
        Checks:
        - Has activities?
        - Has linked transactions?
        - Has evidence files?
        
        Args:
            db: SQLAlchemy session
            project_id: UUID of the project
            
        Returns:
            Dict with evidence status and completeness percentage
        """
        project = self.get_by_id(db, project_id)
        if not project:
            return None
        
        # Check has activities
        activities_count = self._get_activities_count(db, project_id)
        has_activities = activities_count > 0
        
        # Check has linked transactions
        stmt = select(func.count()).select_from(TransactionAllocation).where(
            TransactionAllocation.project_id == project_id
        )
        transaction_count = db.execute(stmt).scalar() or 0
        has_transactions = transaction_count > 0
        
        # Check has evidence files (linked to project or activities)
        stmt = select(func.count()).select_from(EvidenceFile).where(
            and_(
                EvidenceFile.linked_type == LinkedType.PROJECT,
                EvidenceFile.linked_id == project_id
            )
        )
        project_evidence = db.execute(stmt).scalar() or 0
        
        # Get activity IDs for this project
        stmt = select(RdActivity.id).where(RdActivity.project_id == project_id)
        activity_ids = [row[0] for row in db.execute(stmt).all()]
        
        activity_evidence = 0
        if activity_ids:
            stmt = select(func.count()).select_from(EvidenceFile).where(
                and_(
                    EvidenceFile.linked_type == LinkedType.ACTIVITY,
                    EvidenceFile.linked_id.in_(activity_ids)
                )
            )
            activity_evidence = db.execute(stmt).scalar() or 0
        
        total_evidence = project_evidence + activity_evidence
        has_evidence = total_evidence > 0
        
        # Calculate completeness percentage
        checks = [
            has_activities,
            has_transactions,
            has_evidence
        ]
        completeness = (sum(checks) / len(checks)) * 100
        
        return {
            "project_id": project_id,
            "has_activities": has_activities,
            "activities_count": activities_count,
            "has_transactions": has_transactions,
            "transactions_count": transaction_count,
            "has_evidence_files": has_evidence,
            "evidence_files_count": total_evidence,
            "completeness_percentage": round(completeness, 1)
        }
    
    def list_with_stats(
        self,
        db: Session,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        List projects with budget vs actual spend statistics.
        
        Args:
            db: SQLAlchemy session
            filters: Optional dictionary of filters (e.g., status)
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with paginated projects including stats
        """
        query = select(Project)
        
        # Apply filters
        if filters:
            conditions = []
            if 'status' in filters and filters['status'] is not None:
                conditions.append(Project.status == filters['status'])
            if conditions:
                query = query.where(and_(*conditions))
        
        result = paginate(db, query, page, page_size)
        
        # Enhance with stats
        items_with_stats = []
        for project in result["items"]:
            activities_count = self._get_activities_count(db, project.id)
            total_spend = self._get_total_spend(db, project.id)
            evidence_status = self.get_evidence_status(db, project.id)
            
            items_with_stats.append({
                "id": project.id,
                "code": project.code,
                "name": project.name,
                "description": project.description,
                "status": project.status,
                "start_date": project.start_date,
                "end_date": project.end_date,
                "budget": float(project.budget) if project.budget else None,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "activities_count": activities_count,
                "total_spend": float(total_spend),
                "evidence_completeness": evidence_status["completeness_percentage"]
            })
        
        return {
            "items": items_with_stats,
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"]
        }


# Service instance
project_service = ProjectService()
