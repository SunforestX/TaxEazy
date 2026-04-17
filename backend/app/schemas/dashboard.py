from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel
import uuid


class DashboardStats(BaseModel):
    total_spent: Decimal  # This month
    rd_eligible_spend_ytd: Decimal
    gst_position: Decimal  # Net GST for current quarter
    payg_withheld: Decimal  # This month
    monthly_burn_rate: Decimal  # Average of last 3 months
    unclassified_transactions_count: int
    missing_evidence_count: int
    open_exceptions_count: int

    class Config:
        from_attributes = True


class ComplianceReminder(BaseModel):
    type: str
    message: str
    severity: str  # info, warning, critical
    due_date: Optional[date] = None

    class Config:
        from_attributes = True


class RecentActivityItem(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    description: str
    timestamp: datetime
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    stats: DashboardStats
    compliance_reminders: List[ComplianceReminder]
    recent_activity: List[RecentActivityItem]

    class Config:
        from_attributes = True
