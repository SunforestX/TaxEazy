from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract

from app.schemas.dashboard import (
    DashboardStats,
    ComplianceReminder,
    RecentActivityItem
)
from app.models.transaction import Transaction, RdRelevance
from app.models.payroll import PayrollRun, PayrollItem
from app.models.bas_period import BasPeriod, BasStatus
from app.models.exception import Exception as ExceptionModel, Severity
from app.models.evidence_file import EvidenceFile, LinkedType
from app.models.audit_event import AuditEvent
from app.models.user import User


class DashboardService:
    """Service for dashboard data aggregation and calculations."""

    def _get_current_financial_year_start(self) -> date:
        """Get the start date of the current Australian financial year (July 1)."""
        today = date.today()
        if today.month >= 7:
            return date(today.year, 7, 1)
        else:
            return date(today.year - 1, 7, 1)

    def _get_current_quarter_dates(self) -> tuple[date, date]:
        """Get the start and end dates of the current quarter."""
        today = date.today()
        month = today.month
        year = today.year
        
        # Australian BAS quarters: Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun
        if month in [7, 8, 9]:
            return (date(year, 7, 1), date(year, 9, 30))
        elif month in [10, 11, 12]:
            return (date(year, 10, 1), date(year, 12, 31))
        elif month in [1, 2, 3]:
            return (date(year, 1, 1), date(year, 3, 31))
        else:  # Apr, May, Jun
            return (date(year, 4, 1), date(year, 6, 30))

    def _get_month_start_end(self, year: int, month: int) -> tuple[date, date]:
        """Get the start and end dates of a specific month."""
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)
        return (start, end)

    def get_stats(self, db: Session) -> DashboardStats:
        """Calculate and return all dashboard statistics."""
        today = date.today()
        
        # Current month range
        month_start, month_end = self._get_month_start_end(today.year, today.month)
        
        # Financial year start
        fy_start = self._get_current_financial_year_start()
        
        # Current quarter range
        quarter_start, quarter_end = self._get_current_quarter_dates()

        # 1. Total spent this month (sum of expense transactions - negative amounts)
        total_spent_result = db.query(
            func.coalesce(func.sum(Transaction.amount), Decimal('0'))
        ).filter(
            Transaction.date >= month_start,
            Transaction.date <= month_end,
            Transaction.amount < 0
        ).scalar()
        total_spent = abs(total_spent_result) if total_spent_result else Decimal('0')

        # 2. R&D eligible spend YTD (transactions where rd_relevance is YES or PARTIAL)
        rd_eligible_result = db.query(
            func.coalesce(func.sum(Transaction.amount), Decimal('0'))
        ).filter(
            Transaction.date >= fy_start,
            Transaction.date <= today,
            Transaction.rd_relevance.in_([RdRelevance.YES, RdRelevance.PARTIAL])
        ).scalar()
        rd_eligible_spend_ytd = abs(rd_eligible_result) if rd_eligible_result else Decimal('0')

        # 3. GST position for current quarter
        # GST collected on sales (positive amounts with GST)
        gst_collected_result = db.query(
            func.coalesce(func.sum(Transaction.gst_amount), Decimal('0'))
        ).filter(
            Transaction.date >= quarter_start,
            Transaction.date <= quarter_end,
            Transaction.amount > 0,
            Transaction.gst_amount.isnot(None)
        ).scalar()
        gst_collected = gst_collected_result if gst_collected_result else Decimal('0')

        # GST paid on purchases (negative amounts with GST)
        gst_paid_result = db.query(
            func.coalesce(func.sum(Transaction.gst_amount), Decimal('0'))
        ).filter(
            Transaction.date >= quarter_start,
            Transaction.date <= quarter_end,
            Transaction.amount < 0,
            Transaction.gst_amount.isnot(None)
        ).scalar()
        gst_paid = abs(gst_paid_result) if gst_paid_result else Decimal('0')

        # Net GST position (positive = payable, negative = refundable)
        gst_position = gst_collected - gst_paid

        # 4. PAYG withheld this month
        payg_result = db.query(
            func.coalesce(func.sum(PayrollItem.payg_withheld), Decimal('0'))
        ).join(
            PayrollRun, PayrollItem.payroll_run_id == PayrollRun.id
        ).filter(
            PayrollRun.pay_date >= month_start,
            PayrollRun.pay_date <= month_end
        ).scalar()
        payg_withheld = payg_result if payg_result else Decimal('0')

        # 5. Monthly burn rate (average monthly spend over last 3 months)
        three_months_ago = today - timedelta(days=90)
        monthly_spends = []
        
        for i in range(3):
            check_date = today - timedelta(days=i * 30)
            m_start, m_end = self._get_month_start_end(check_date.year, check_date.month)
            
            month_spend_result = db.query(
                func.coalesce(func.sum(Transaction.amount), Decimal('0'))
            ).filter(
                Transaction.date >= m_start,
                Transaction.date <= m_end,
                Transaction.amount < 0
            ).scalar()
            month_spend = abs(month_spend_result) if month_spend_result else Decimal('0')
            monthly_spends.append(month_spend)

        monthly_burn_rate = sum(monthly_spends) / len(monthly_spends) if monthly_spends else Decimal('0')

        # 6. Unclassified transactions count (category IS NULL)
        unclassified_count = db.query(func.count(Transaction.id)).filter(
            Transaction.category.is_(None)
        ).scalar() or 0

        # 7. Missing evidence count (transactions > $1000 without evidence files)
        # Get transaction IDs that have evidence
        transaction_ids_with_evidence = db.query(EvidenceFile.linked_id).filter(
            EvidenceFile.linked_type == LinkedType.TRANSACTION
        ).subquery()

        missing_evidence_count = db.query(func.count(Transaction.id)).filter(
            Transaction.amount < -1000,  # Expenses over $1000
            ~Transaction.id.in_(transaction_ids_with_evidence)
        ).scalar() or 0

        # 8. Open exceptions count
        open_exceptions_count = db.query(func.count(ExceptionModel.id)).filter(
            ExceptionModel.is_resolved == False
        ).scalar() or 0

        return DashboardStats(
            total_spent=total_spent,
            rd_eligible_spend_ytd=rd_eligible_spend_ytd,
            gst_position=gst_position,
            payg_withheld=payg_withheld,
            monthly_burn_rate=monthly_burn_rate,
            unclassified_transactions_count=unclassified_count,
            missing_evidence_count=missing_evidence_count,
            open_exceptions_count=open_exceptions_count
        )

    def get_compliance_reminders(self, db: Session) -> List[ComplianceReminder]:
        """Generate compliance reminders based on current system state."""
        reminders = []
        today = date.today()

        # 1. Check if current BAS period is overdue
        quarter_start, quarter_end = self._get_current_quarter_dates()
        
        # BAS is due on the 28th of the month after quarter end
        if quarter_end.month in [9, 12]:
            due_month = quarter_end.month + 1
            due_year = quarter_end.year
        elif quarter_end.month == 3:
            due_month = 4
            due_year = quarter_end.year
        else:  # June
            due_month = 7
            due_year = quarter_end.year
        
        bas_due_date = date(due_year, due_month, 28)
        
        # Check if there's a finalized BAS for current quarter
        current_bas = db.query(BasPeriod).filter(
            BasPeriod.period_start == quarter_start,
            BasPeriod.period_end == quarter_end,
            BasPeriod.status == BasStatus.FINALISED
        ).first()

        if not current_bas:
            days_until_due = (bas_due_date - today).days
            if days_until_due < 0:
                reminders.append(ComplianceReminder(
                    type="bas_overdue",
                    message=f"BAS for Q{self._get_quarter_number(quarter_end.month)} is overdue",
                    severity="critical",
                    due_date=bas_due_date
                ))
            elif days_until_due <= 7:
                reminders.append(ComplianceReminder(
                    type="bas_due_soon",
                    message=f"BAS for Q{self._get_quarter_number(quarter_end.month)} is due in {days_until_due} days",
                    severity="warning",
                    due_date=bas_due_date
                ))

        # 2. Check if PAYG for current month has been recorded
        month_start, month_end = self._get_month_start_end(today.year, today.month)
        current_payroll = db.query(PayrollRun).filter(
            PayrollRun.pay_date >= month_start,
            PayrollRun.pay_date <= month_end
        ).first()

        if not current_payroll:
            reminders.append(ComplianceReminder(
                type="payroll_missing",
                message=f"No payroll recorded for {today.strftime('%B %Y')}",
                severity="warning"
            ))

        # 3. Check for HIGH severity unresolved exceptions
        high_severity_count = db.query(func.count(ExceptionModel.id)).filter(
            ExceptionModel.is_resolved == False,
            ExceptionModel.severity == Severity.HIGH
        ).scalar() or 0

        if high_severity_count > 0:
            reminders.append(ComplianceReminder(
                type="high_severity_exceptions",
                message=f"{high_severity_count} high severity exception(s) require attention",
                severity="critical"
            ))

        # 4. Check for unclassified transactions
        unclassified_count = db.query(func.count(Transaction.id)).filter(
            Transaction.category.is_(None)
        ).scalar() or 0

        if unclassified_count > 0:
            reminders.append(ComplianceReminder(
                type="unclassified_transactions",
                message=f"{unclassified_count} transaction(s) need categorization",
                severity="info"
            ))

        # 5. Check for missing evidence on high-value transactions
        transaction_ids_with_evidence = db.query(EvidenceFile.linked_id).filter(
            EvidenceFile.linked_type == LinkedType.TRANSACTION
        ).subquery()

        missing_evidence_count = db.query(func.count(Transaction.id)).filter(
            Transaction.amount < -1000,
            ~Transaction.id.in_(transaction_ids_with_evidence)
        ).scalar() or 0

        if missing_evidence_count > 0:
            reminders.append(ComplianceReminder(
                type="missing_evidence",
                message=f"{missing_evidence_count} high-value transaction(s) missing evidence",
                severity="warning"
            ))

        return reminders

    def _get_quarter_number(self, month: int) -> int:
        """Get quarter number from month (Australian FY quarters)."""
        if month in [7, 8, 9]:
            return 1
        elif month in [10, 11, 12]:
            return 2
        elif month in [1, 2, 3]:
            return 3
        else:  # Apr, May, Jun
            return 4

    def get_recent_activity(self, db: Session, limit: int = 10) -> List[RecentActivityItem]:
        """Get recent activity from audit events."""
        activities = db.query(
            AuditEvent,
            User.email.label('user_email')
        ).outerjoin(
            User, AuditEvent.user_id == User.id
        ).order_by(
            AuditEvent.timestamp.desc()
        ).limit(limit).all()

        result = []
        for activity, user_email in activities:
            description = self._format_activity_description(activity)
            
            result.append(RecentActivityItem(
                id=activity.id,
                action=activity.action.value if hasattr(activity.action, 'value') else str(activity.action),
                entity_type=activity.entity_type,
                description=description,
                timestamp=activity.timestamp,
                user_email=user_email
            ))

        return result

    def _format_activity_description(self, event: AuditEvent) -> str:
        """Format a human-readable description for an audit event."""
        action_map = {
            "CREATE": "created",
            "UPDATE": "updated",
            "DELETE": "deleted",
            "IMPORT": "imported",
            "UPLOAD": "uploaded",
            "STATUS_CHANGE": "changed status of"
        }
        
        action_str = action_map.get(
            event.action.value if hasattr(event.action, 'value') else str(event.action),
            "modified"
        )
        
        entity_type = event.entity_type.replace("_", " ").title()
        
        return f"{action_str} {entity_type}"


# Singleton instance
dashboard_service = DashboardService()
