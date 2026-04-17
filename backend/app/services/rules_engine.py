import uuid
from dataclasses import dataclass
from typing import List, Optional, Callable, Dict, Any
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, not_, exists

from app.models.exception import Exception, ExceptionType, Severity, EntityType
from app.models.transaction import Transaction, TransactionAllocation
from app.models.payroll import PayrollItem
from app.models.project import Project
from app.models.rd_activity import RdActivity
from app.models.evidence_file import EvidenceFile, LinkedType
from app.models.employee import Employee


@dataclass
class Rule:
    id: str
    name: str
    description: str
    exception_type: ExceptionType
    severity: Severity
    entity_type: EntityType
    evaluate: Callable[[Session], int]


class RulesEngine:
    def __init__(self):
        self.rules: List[Rule] = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        """Register all built-in rules."""
        self.rules = [
            Rule(
                id="MISSING_GST",
                name="Missing GST Treatment",
                description="Find transactions where GST treatment is not set",
                exception_type=ExceptionType.MISSING_GST,
                severity=Severity.HIGH,
                entity_type=EntityType.TRANSACTION,
                evaluate=self._evaluate_missing_gst
            ),
            Rule(
                id="UNCATEGORIZED",
                name="Uncategorized Transaction",
                description="Find transactions where category is not set",
                exception_type=ExceptionType.UNCATEGORIZED,
                severity=Severity.MEDIUM,
                entity_type=EntityType.TRANSACTION,
                evaluate=self._evaluate_uncategorized
            ),
            Rule(
                id="HIGH_VALUE_NO_PROJECT",
                name="High Value Transaction Without Project",
                description="Find transactions over $5000 with no project allocation",
                exception_type=ExceptionType.HIGH_VALUE_NO_PROJECT,
                severity=Severity.HIGH,
                entity_type=EntityType.TRANSACTION,
                evaluate=self._evaluate_high_value_no_project
            ),
            Rule(
                id="UNLINKED_RD_SPEND",
                name="Unlinked R&D Spend",
                description="Find projects with transaction allocations or payroll items but no R&D activities",
                exception_type=ExceptionType.UNLINKED_RD_SPEND,
                severity=Severity.MEDIUM,
                entity_type=EntityType.PROJECT,
                evaluate=self._evaluate_unlinked_rd_spend
            ),
            Rule(
                id="MISSING_EVIDENCE",
                name="Missing Evidence for High Value Transaction",
                description="Find transactions over $1000 without supporting evidence files",
                exception_type=ExceptionType.MISSING_EVIDENCE,
                severity=Severity.HIGH,
                entity_type=EntityType.TRANSACTION,
                evaluate=self._evaluate_missing_evidence
            ),
            Rule(
                id="MISSING_PAYROLL_ALLOCATION",
                name="Missing Payroll Allocation for Scientist",
                description="Find payroll items for scientists without project allocations",
                exception_type=ExceptionType.MISSING_PAYROLL_ALLOCATION,
                severity=Severity.MEDIUM,
                entity_type=EntityType.PAYROLL_ITEM,
                evaluate=self._evaluate_missing_payroll_allocation
            ),
        ]
    
    def _exception_exists(
        self, 
        db: Session, 
        exception_type: ExceptionType, 
        entity_type: EntityType, 
        entity_id: uuid.UUID
    ) -> bool:
        """Check if an unresolved exception already exists for this entity."""
        stmt = select(Exception).where(
            and_(
                Exception.exception_type == exception_type,
                Exception.entity_type == entity_type,
                Exception.entity_id == entity_id,
                Exception.is_resolved == False
            )
        )
        result = db.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    def _create_exception(
        self,
        db: Session,
        exception_type: ExceptionType,
        severity: Severity,
        entity_type: EntityType,
        entity_id: uuid.UUID,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ) -> Exception:
        """Create a new exception record."""
        exception = Exception(
            exception_type=exception_type,
            severity=severity,
            entity_type=entity_type,
            entity_id=entity_id,
            message=message,
            is_resolved=False,
            created_at=datetime.utcnow()
        )
        db.add(exception)
        return exception
    
    def _evaluate_missing_gst(self, db: Session) -> int:
        """Find transactions where gst_treatment IS NULL."""
        count = 0
        stmt = select(Transaction).where(Transaction.gst_treatment.is_(None))
        result = db.execute(stmt)
        transactions = result.scalars().all()
        
        for transaction in transactions:
            if not self._exception_exists(
                db, 
                ExceptionType.MISSING_GST, 
                EntityType.TRANSACTION, 
                transaction.id
            ):
                self._create_exception(
                    db,
                    exception_type=ExceptionType.MISSING_GST,
                    severity=Severity.HIGH,
                    entity_type=EntityType.TRANSACTION,
                    entity_id=transaction.id,
                    message=f"Transaction '{transaction.description[:50]}...' (${float(transaction.amount):.2f}) is missing GST treatment"
                )
                count += 1
        
        return count
    
    def _evaluate_uncategorized(self, db: Session) -> int:
        """Find transactions where category IS NULL."""
        count = 0
        stmt = select(Transaction).where(Transaction.category.is_(None))
        result = db.execute(stmt)
        transactions = result.scalars().all()
        
        for transaction in transactions:
            if not self._exception_exists(
                db, 
                ExceptionType.UNCATEGORIZED, 
                EntityType.TRANSACTION, 
                transaction.id
            ):
                self._create_exception(
                    db,
                    exception_type=ExceptionType.UNCATEGORIZED,
                    severity=Severity.MEDIUM,
                    entity_type=EntityType.TRANSACTION,
                    entity_id=transaction.id,
                    message=f"Transaction '{transaction.description[:50]}...' (${float(transaction.amount):.2f}) is uncategorized"
                )
                count += 1
        
        return count
    
    def _evaluate_high_value_no_project(self, db: Session) -> int:
        """Find transactions where amount > 5000 AND no entry in transaction_allocations."""
        count = 0
        # Find transactions with amount > 5000 that have no allocations
        stmt = select(Transaction).where(
            and_(
                Transaction.amount > Decimal("5000"),
                not_(
                    exists().where(
                        TransactionAllocation.transaction_id == Transaction.id
                    )
                )
            )
        )
        result = db.execute(stmt)
        transactions = result.scalars().all()
        
        for transaction in transactions:
            if not self._exception_exists(
                db, 
                ExceptionType.HIGH_VALUE_NO_PROJECT, 
                EntityType.TRANSACTION, 
                transaction.id
            ):
                self._create_exception(
                    db,
                    exception_type=ExceptionType.HIGH_VALUE_NO_PROJECT,
                    severity=Severity.HIGH,
                    entity_type=EntityType.TRANSACTION,
                    entity_id=transaction.id,
                    message=f"High-value transaction '{transaction.description[:50]}...' (${float(transaction.amount):.2f}) has no project allocation"
                )
                count += 1
        
        return count
    
    def _evaluate_unlinked_rd_spend(self, db: Session) -> int:
        """Find projects with transaction allocations or payroll items but zero rd_activities."""
        count = 0
        # Find all projects that have allocations or payroll items
        stmt = select(Project).where(
            and_(
                Project.status.in_(["active", "completed"]),
                (
                    exists().where(
                        TransactionAllocation.project_id == Project.id
                    ) |
                    exists().where(
                        PayrollItem.project_allocations.isnot(None)
                    )
                ),
                not_(
                    exists().where(
                        RdActivity.project_id == Project.id
                    )
                )
            )
        )
        result = db.execute(stmt)
        projects = result.scalars().all()
        
        for project in projects:
            if not self._exception_exists(
                db, 
                ExceptionType.UNLINKED_RD_SPEND, 
                EntityType.PROJECT, 
                project.id
            ):
                self._create_exception(
                    db,
                    exception_type=ExceptionType.UNLINKED_RD_SPEND,
                    severity=Severity.MEDIUM,
                    entity_type=EntityType.PROJECT,
                    entity_id=project.id,
                    message=f"Project '{project.code} - {project.name}' has spending but no R&D activities recorded"
                )
                count += 1
        
        return count
    
    def _evaluate_missing_evidence(self, db: Session) -> int:
        """Find transactions where amount > 1000 AND no evidence_files linked."""
        count = 0
        # Find transactions with amount > 1000 that have no evidence files
        stmt = select(Transaction).where(
            and_(
                Transaction.amount > Decimal("1000"),
                not_(
                    exists().where(
                        and_(
                            EvidenceFile.linked_type == LinkedType.TRANSACTION,
                            EvidenceFile.linked_id == Transaction.id
                        )
                    )
                )
            )
        )
        result = db.execute(stmt)
        transactions = result.scalars().all()
        
        for transaction in transactions:
            if not self._exception_exists(
                db, 
                ExceptionType.MISSING_EVIDENCE, 
                EntityType.TRANSACTION, 
                transaction.id
            ):
                self._create_exception(
                    db,
                    exception_type=ExceptionType.MISSING_EVIDENCE,
                    severity=Severity.HIGH,
                    entity_type=EntityType.TRANSACTION,
                    entity_id=transaction.id,
                    message=f"Transaction '{transaction.description[:50]}...' (${float(transaction.amount):.2f}) is missing supporting evidence"
                )
                count += 1
        
        return count
    
    def _evaluate_missing_payroll_allocation(self, db: Session) -> int:
        """Find payroll_items where employee.is_scientist=True AND project_allocations is NULL or empty."""
        count = 0
        # Find payroll items for scientists with no allocations
        stmt = select(PayrollItem).join(Employee).where(
            and_(
                Employee.is_scientist == True,
                (
                    PayrollItem.project_allocations.is_(None) |
                    (PayrollItem.project_allocations == []) |
                    (PayrollItem.project_allocations == "[]")
                )
            )
        )
        result = db.execute(stmt)
        payroll_items = result.scalars().all()
        
        for item in payroll_items:
            if not self._exception_exists(
                db, 
                ExceptionType.MISSING_PAYROLL_ALLOCATION, 
                EntityType.PAYROLL_ITEM, 
                item.id
            ):
                employee_name = item.employee.name if item.employee else "Unknown"
                self._create_exception(
                    db,
                    exception_type=ExceptionType.MISSING_PAYROLL_ALLOCATION,
                    severity=Severity.MEDIUM,
                    entity_type=EntityType.PAYROLL_ITEM,
                    entity_id=item.id,
                    message=f"Payroll item for scientist '{employee_name}' (${float(item.gross_wages):.2f}) has no project allocation"
                )
                count += 1
        
        return count
    
    def run_all(self, db: Session) -> Dict[str, int]:
        """
        Run all rules, create Exception records for violations.
        Returns summary: {rule_id: count_of_exceptions}
        """
        results = {}
        for rule in self.rules:
            count = rule.evaluate(db)
            results[rule.id] = count
        return results
    
    def run_rule(self, db: Session, rule_id: str) -> int:
        """Run a single rule by ID."""
        rule = next((r for r in self.rules if r.id == rule_id), None)
        if rule is None:
            raise ValueError(f"Rule with ID '{rule_id}' not found")
        return rule.evaluate(db)
    
    def get_rules(self) -> List[Dict[str, Any]]:
        """Return list of rule definitions."""
        return [
            {
                "id": rule.id,
                "name": rule.name,
                "description": rule.description,
                "exception_type": rule.exception_type.value,
                "severity": rule.severity.value,
                "entity_type": rule.entity_type.value
            }
            for rule in self.rules
        ]


# Singleton instance
rules_engine = RulesEngine()
