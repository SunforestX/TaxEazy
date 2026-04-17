import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, extract
from collections import defaultdict

from app.models.transaction import Transaction, RdRelevance, TransactionAllocation
from app.models.payroll import PayrollRun, PayrollItem
from app.models.project import Project
from app.models.bas_period import BasPeriod, BasStatus
from app.models.exception import Exception, Severity
from app.models.evidence_file import EvidenceFile, LinkedType
from app.models.supplier import Category, GstTreatment


class ReportingService:
    """Service class for generating financial and compliance reports."""

    def get_monthly_report(
        self,
        db: Session,
        year: int,
        month: int
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive monthly report aggregating all financial data.

        Args:
            db: SQLAlchemy session
            year: Report year
            month: Report month (1-12)

        Returns:
            Dict with monthly report data
        """
        # Calculate date range for the month
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)

        # GST Summary
        gst_summary = self._calculate_monthly_gst(db, start_date, end_date)

        # PAYG Summary
        payg_summary = self._calculate_monthly_payg(db, start_date, end_date)

        # Total Operating Spend
        total_operating_spend = self._calculate_operating_spend(db, start_date, end_date)

        # R&D Eligible Spend
        rd_eligible_spend, rd_by_project = self._calculate_rd_spend(db, start_date, end_date)

        # Outstanding Issues
        outstanding_issues_count = self._count_unresolved_exceptions(db)

        # Missing Evidence
        missing_evidence_count = self._count_missing_evidence(db, start_date, end_date)

        # Unresolved exceptions by type
        unresolved_exceptions = self._get_unresolved_exceptions_by_type(db)

        return {
            "month": month,
            "year": year,
            "gst_summary": gst_summary,
            "payg_summary": payg_summary,
            "total_operating_spend": total_operating_spend,
            "rd_eligible_spend": rd_eligible_spend,
            "rd_spend_by_project": rd_by_project,
            "outstanding_issues_count": outstanding_issues_count,
            "missing_evidence_count": missing_evidence_count,
            "unresolved_exceptions": unresolved_exceptions
        }

    def export_monthly_report(
        self,
        db: Session,
        year: int,
        month: int
    ) -> List[Dict[str, Any]]:
        """
        Format monthly report data as CSV-ready rows.

        Args:
            db: SQLAlchemy session
            year: Report year
            month: Report month

        Returns:
            List of dicts suitable for CSV export
        """
        report = self.get_monthly_report(db, year, month)
        rows = []

        # GST Section
        rows.append({"category": "GST", "item": "GST Collected", "amount": report["gst_summary"]["collected"], "details": ""})
        rows.append({"category": "GST", "item": "GST Paid", "amount": report["gst_summary"]["paid"], "details": ""})
        rows.append({"category": "GST", "item": "Net GST", "amount": report["gst_summary"]["net"], "details": ""})

        # PAYG Section
        rows.append({"category": "PAYG", "item": "Total Gross Wages", "amount": report["payg_summary"]["total_gross"], "details": ""})
        rows.append({"category": "PAYG", "item": "Total PAYG Withheld", "amount": report["payg_summary"]["total_payg"], "details": ""})
        rows.append({"category": "PAYG", "item": "Total Super", "amount": report["payg_summary"]["total_super"], "details": f"Employees: {report['payg_summary']['employee_count']}"})

        # Spend Section
        rows.append({"category": "Spend", "item": "Total Operating Spend", "amount": report["total_operating_spend"], "details": ""})
        rows.append({"category": "Spend", "item": "R&D Eligible Spend", "amount": report["rd_eligible_spend"], "details": ""})

        # R&D by Project
        for proj in report["rd_spend_by_project"]:
            rows.append({"category": "R&D by Project", "item": proj["project_name"], "amount": proj["amount"], "details": ""})

        # Issues Section
        rows.append({"category": "Issues", "item": "Outstanding Issues", "amount": Decimal(report["outstanding_issues_count"]), "details": ""})
        rows.append({"category": "Issues", "item": "Missing Evidence", "amount": Decimal(report["missing_evidence_count"]), "details": ""})

        # Unresolved Exceptions
        for exc in report["unresolved_exceptions"]:
            rows.append({"category": "Exceptions", "item": exc["type"], "amount": Decimal(exc["count"]), "details": ""})

        return rows

    def get_rd_summary(
        self,
        db: Session,
        financial_year_start: date
    ) -> Dict[str, Any]:
        """
        Generate year-to-date R&D spend summary by project and category.
        Australian financial year runs July 1 - June 30.

        Args:
            db: SQLAlchemy session
            financial_year_start: Start date of the financial year (July 1)

        Returns:
            Dict with R&D summary data
        """
        # Calculate end date (June 30 of next year)
        if financial_year_start.month == 7:
            financial_year_end = date(financial_year_start.year + 1, 6, 30)
        else:
            # Adjust if not starting in July
            financial_year_end = date(financial_year_start.year + 1, financial_year_start.month, financial_year_start.day)

        # Get all R&D relevant transactions in the period
        query = select(Transaction).where(
            and_(
                Transaction.date >= financial_year_start,
                Transaction.date <= financial_year_end,
                Transaction.rd_relevance.in_([RdRelevance.YES, RdRelevance.PARTIAL])
            )
        )
        result = db.execute(query)
        transactions = result.scalars().all()

        # Get all transaction allocations in the period
        alloc_query = select(TransactionAllocation).join(Transaction).where(
            and_(
                Transaction.date >= financial_year_start,
                Transaction.date <= financial_year_end
            )
        )
        alloc_result = db.execute(alloc_query)
        allocations = alloc_result.scalars().all()

        # Get payroll items with project allocations in the period
        payroll_query = select(PayrollItem, PayrollRun).join(PayrollRun).where(
            and_(
                PayrollRun.pay_date >= financial_year_start,
                PayrollRun.pay_date <= financial_year_end
            )
        )
        payroll_result = db.execute(payroll_query)
        payroll_items = payroll_result.all()

        # Calculate spend by project
        project_spend: Dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        category_spend: Dict[str, Decimal] = defaultdict(Decimal)

        # Process transaction allocations
        for alloc in allocations:
            project_spend[alloc.project_id] += alloc.amount

        # Process payroll project allocations
        for item, run in payroll_items:
            if item.project_allocations:
                for alloc in item.project_allocations:
                    proj_id = uuid.UUID(alloc.get("project_id")) if isinstance(alloc.get("project_id"), str) else alloc.get("project_id")
                    percentage = Decimal(str(alloc.get("percentage", 0)))
                    if proj_id and percentage > 0:
                        allocated_amount = (item.gross_wages * percentage) / Decimal("100")
                        project_spend[proj_id] += allocated_amount
                        category_spend["Salaries"] += allocated_amount

        # Process R&D transactions by category
        for t in transactions:
            if t.category:
                category_spend[t.category.value] += t.amount

        # Get project details
        project_ids = list(project_spend.keys())
        projects = {}
        if project_ids:
            proj_query = select(Project).where(Project.id.in_(project_ids))
            proj_result = db.execute(proj_query)
            for p in proj_result.scalars().all():
                projects[p.id] = p

        # Build by_project list
        total_rd_spend = sum(project_spend.values())
        by_project = []
        for proj_id, spend in project_spend.items():
            proj = projects.get(proj_id)
            percentage = (spend / total_rd_spend * 100) if total_rd_spend > 0 else Decimal("0")
            by_project.append({
                "project_id": str(proj_id),
                "project_name": proj.name if proj else "Unknown",
                "spend": spend,
                "percentage": percentage.quantize(Decimal("0.01"))
            })

        # Sort by spend descending
        by_project.sort(key=lambda x: x["spend"], reverse=True)

        # Format financial year string
        fy_end_year = financial_year_start.year + 1
        financial_year = f"FY{financial_year_start.year}-{fy_end_year}"

        return {
            "financial_year": financial_year,
            "total_rd_spend": total_rd_spend,
            "by_project": by_project,
            "by_category": dict(category_spend)
        }

    def get_compliance_status(self, db: Session) -> Dict[str, Any]:
        """
        Get current compliance status including BAS, PAYG, evidence gaps, and exceptions.

        Args:
            db: SQLAlchemy session

        Returns:
            Dict with compliance status data
        """
        # Check latest BAS period status
        bas_status = self._get_bas_status(db)

        # Check current month PAYG completeness
        payg_status = self._get_payg_status(db)

        # Count evidence gaps (transactions >$1000 without evidence)
        evidence_gaps_count = self._count_evidence_gaps(db)

        # Count unresolved exceptions
        unresolved_exceptions_count = self._count_unresolved_exceptions(db)

        # Check for high severity exceptions
        high_severity_count = self._count_high_severity_exceptions(db)
        medium_severity_count = self._count_medium_severity_exceptions(db)

        # Determine overall status
        if high_severity_count > 0:
            overall_status = "critical"
        elif medium_severity_count > 0 or evidence_gaps_count > 0:
            overall_status = "warning"
        else:
            overall_status = "good"

        return {
            "bas_status": bas_status,
            "payg_status": payg_status,
            "evidence_gaps_count": evidence_gaps_count,
            "unresolved_exceptions_count": unresolved_exceptions_count,
            "overall_status": overall_status
        }

    def _calculate_monthly_gst(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> Dict[str, Decimal]:
        """Calculate GST summary for a date range."""
        query = select(Transaction).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date < end_date
            )
        )
        result = db.execute(query)
        transactions = result.scalars().all()

        gst_applicable = (GstTreatment.CAP, GstTreatment.EXP)
        gst_collected = Decimal("0")
        gst_paid = Decimal("0")

        for t in transactions:
            if t.gst_treatment in gst_applicable and t.gst_amount:
                if t.amount > 0:
                    gst_collected += t.gst_amount
                elif t.amount < 0:
                    gst_paid += t.gst_amount

        net_gst = gst_collected - gst_paid

        return {
            "collected": gst_collected,
            "paid": gst_paid,
            "net": net_gst
        }

    def _calculate_monthly_payg(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Calculate PAYG summary for a date range."""
        query = select(PayrollRun).where(
            and_(
                PayrollRun.pay_date >= start_date,
                PayrollRun.pay_date < end_date
            )
        )
        result = db.execute(query)
        payroll_runs = result.scalars().all()

        total_gross = Decimal("0")
        total_payg = Decimal("0")
        total_super = Decimal("0")
        employee_ids = set()

        for run in payroll_runs:
            total_gross += run.total_gross or Decimal("0")
            total_payg += run.total_payg or Decimal("0")
            total_super += run.total_super or Decimal("0")

            # Count unique employees
            for item in run.items:
                employee_ids.add(item.employee_id)

        return {
            "total_gross": total_gross,
            "total_payg": total_payg,
            "total_super": total_super,
            "employee_count": len(employee_ids)
        }

    def _calculate_operating_spend(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> Decimal:
        """Calculate total operating spend (expenses) for a date range."""
        query = select(func.sum(Transaction.amount)).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date < end_date,
                Transaction.amount < 0  # Expenses are negative
            )
        )
        result = db.execute(query)
        total = result.scalar() or Decimal("0")
        return abs(total)  # Return as positive number

    def _calculate_rd_spend(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        """Calculate R&D eligible spend and breakdown by project."""
        # Get R&D relevant transactions
        query = select(Transaction).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date < end_date,
                Transaction.rd_relevance.in_([RdRelevance.YES, RdRelevance.PARTIAL])
            )
        )
        result = db.execute(query)
        transactions = result.scalars().all()

        # Get allocations for these transactions
        transaction_ids = [t.id for t in transactions]
        project_spend: Dict[uuid.UUID, Decimal] = defaultdict(Decimal)
        total_rd_spend = Decimal("0")

        # Sum transaction amounts
        for t in transactions:
            amount = abs(t.amount) if t.amount < 0 else t.amount
            total_rd_spend += amount

        # Get allocations
        if transaction_ids:
            alloc_query = select(TransactionAllocation).where(
                TransactionAllocation.transaction_id.in_(transaction_ids)
            )
            alloc_result = db.execute(alloc_query)
            for alloc in alloc_result.scalars().all():
                project_spend[alloc.project_id] += alloc.amount

        # Get payroll allocations
        payroll_query = select(PayrollItem, PayrollRun).join(PayrollRun).where(
            and_(
                PayrollRun.pay_date >= start_date,
                PayrollRun.pay_date < end_date
            )
        )
        payroll_result = db.execute(payroll_query)
        for item, run in payroll_result.all():
            if item.project_allocations:
                for alloc in item.project_allocations:
                    proj_id = uuid.UUID(alloc.get("project_id")) if isinstance(alloc.get("project_id"), str) else alloc.get("project_id")
                    percentage = Decimal(str(alloc.get("percentage", 0)))
                    if proj_id and percentage > 0:
                        allocated_amount = (item.gross_wages * percentage) / Decimal("100")
                        project_spend[proj_id] += allocated_amount

        # Get project names
        project_ids = list(project_spend.keys())
        projects = {}
        if project_ids:
            proj_query = select(Project).where(Project.id.in_(project_ids))
            proj_result = db.execute(proj_query)
            for p in proj_result.scalars().all():
                projects[p.id] = p

        # Build result list
        rd_by_project = []
        for proj_id, amount in project_spend.items():
            proj = projects.get(proj_id)
            rd_by_project.append({
                "project_name": proj.name if proj else "Unknown",
                "amount": amount
            })

        return total_rd_spend, rd_by_project

    def _count_unresolved_exceptions(self, db: Session) -> int:
        """Count total unresolved exceptions."""
        query = select(func.count(Exception.id)).where(
            Exception.is_resolved == False
        )
        result = db.execute(query)
        return result.scalar() or 0

    def _count_missing_evidence(
        self,
        db: Session,
        start_date: date,
        end_date: date
    ) -> int:
        """Count transactions >$1000 without evidence files."""
        # Get high-value transactions in the period
        query = select(Transaction.id).where(
            and_(
                Transaction.date >= start_date,
                Transaction.date < end_date,
                func.abs(Transaction.amount) > 1000
            )
        )
        result = db.execute(query)
        transaction_ids = [row[0] for row in result.all()]

        if not transaction_ids:
            return 0

        # Count those without evidence
        evidence_query = select(EvidenceFile.linked_id).where(
            and_(
                EvidenceFile.linked_type == LinkedType.TRANSACTION,
                EvidenceFile.linked_id.in_(transaction_ids)
            )
        )
        evidence_result = db.execute(evidence_query)
        evidenced_ids = set(row[0] for row in evidence_result.all())

        return len(transaction_ids) - len(evidenced_ids)

    def _get_unresolved_exceptions_by_type(self, db: Session) -> List[Dict[str, Any]]:
        """Get count of unresolved exceptions grouped by type."""
        query = select(
            Exception.exception_type,
            func.count(Exception.id)
        ).where(
            Exception.is_resolved == False
        ).group_by(Exception.exception_type)

        result = db.execute(query)
        return [
            {"type": row[0].value, "count": row[1]}
            for row in result.all()
        ]

    def _get_bas_status(self, db: Session) -> Dict[str, Any]:
        """Get current BAS period status."""
        query = select(BasPeriod).order_by(BasPeriod.period_start.desc()).limit(1)
        result = db.execute(query)
        latest_period = result.scalar_one_or_none()

        if not latest_period:
            return {
                "current_period": None,
                "status": "no_periods"
            }

        period_str = f"{latest_period.period_start.strftime('%b %Y')}"
        return {
            "current_period": period_str,
            "status": latest_period.status.value
        }

    def _get_payg_status(self, db: Session) -> Dict[str, Any]:
        """Get current month PAYG status."""
        today = date.today()
        start_of_month = date(today.year, today.month, 1)

        query = select(PayrollRun).where(
            PayrollRun.pay_date >= start_of_month
        )
        result = db.execute(query)
        payroll_runs = result.scalars().all()

        month_str = today.strftime("%B %Y")

        if not payroll_runs:
            return {
                "current_month": month_str,
                "status": "incomplete"
            }

        return {
            "current_month": month_str,
            "status": "complete" if len(payroll_runs) > 0 else "incomplete"
        }

    def _count_evidence_gaps(self, db: Session) -> int:
        """Count transactions >$1000 without evidence (all time)."""
        query = select(Transaction.id).where(
            func.abs(Transaction.amount) > 1000
        )
        result = db.execute(query)
        transaction_ids = [row[0] for row in result.all()]

        if not transaction_ids:
            return 0

        evidence_query = select(EvidenceFile.linked_id).where(
            and_(
                EvidenceFile.linked_type == LinkedType.TRANSACTION,
                EvidenceFile.linked_id.in_(transaction_ids)
            )
        )
        evidence_result = db.execute(evidence_query)
        evidenced_ids = set(row[0] for row in evidence_result.all())

        return len(transaction_ids) - len(evidenced_ids)

    def _count_high_severity_exceptions(self, db: Session) -> int:
        """Count high severity unresolved exceptions."""
        query = select(func.count(Exception.id)).where(
            and_(
                Exception.is_resolved == False,
                Exception.severity == Severity.HIGH
            )
        )
        result = db.execute(query)
        return result.scalar() or 0

    def _count_medium_severity_exceptions(self, db: Session) -> int:
        """Count medium severity unresolved exceptions."""
        query = select(func.count(Exception.id)).where(
            and_(
                Exception.is_resolved == False,
                Exception.severity == Severity.MEDIUM
            )
        )
        result = db.execute(query)
        return result.scalar() or 0


# Create singleton instance
reporting_service = ReportingService()
