from decimal import Decimal
from typing import List, Dict, Optional
from pydantic import BaseModel


class GstSummary(BaseModel):
    collected: Decimal
    paid: Decimal
    net: Decimal


class PaygSummary(BaseModel):
    total_gross: Decimal
    total_payg: Decimal
    total_super: Decimal
    employee_count: int


class RdSpendByProject(BaseModel):
    project_name: str
    amount: Decimal


class UnresolvedException(BaseModel):
    type: str
    count: int


class MonthlyReportResponse(BaseModel):
    month: int
    year: int
    gst_summary: GstSummary
    payg_summary: PaygSummary
    total_operating_spend: Decimal
    rd_eligible_spend: Decimal
    rd_spend_by_project: List[RdSpendByProject]
    outstanding_issues_count: int
    missing_evidence_count: int
    unresolved_exceptions: List[UnresolvedException]


class RdProjectSpend(BaseModel):
    project_id: str
    project_name: str
    spend: Decimal
    percentage: Decimal


class RdSummaryResponse(BaseModel):
    financial_year: str
    total_rd_spend: Decimal
    by_project: List[RdProjectSpend]
    by_category: Dict[str, Decimal]


class BasStatusInfo(BaseModel):
    current_period: Optional[str]
    status: str


class PaygStatusInfo(BaseModel):
    current_month: Optional[str]
    status: str


class ComplianceStatusResponse(BaseModel):
    bas_status: BasStatusInfo
    payg_status: PaygStatusInfo
    evidence_gaps_count: int
    unresolved_exceptions_count: int
    overall_status: str  # good/warning/critical


class MonthlyReportExportRow(BaseModel):
    category: str
    item: str
    amount: Decimal
    details: Optional[str] = None
