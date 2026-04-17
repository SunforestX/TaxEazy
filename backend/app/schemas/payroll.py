from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel


# Project allocation for payroll items
class ProjectAllocation(BaseModel):
    project_id: UUID
    percentage: float


# Payroll Item Schemas
class PayrollItemBase(BaseModel):
    employee_id: UUID
    gross_wages: Decimal
    payg_withheld: Decimal
    super_amount: Decimal
    net_pay: Optional[Decimal] = None
    project_allocations: List[ProjectAllocation] = []
    notes: Optional[str] = None


class PayrollItemCreate(BaseModel):
    employee_id: UUID
    gross_wages: Decimal
    payg_withheld: Decimal
    super_amount: Decimal
    net_pay: Optional[Decimal] = None
    project_allocations: List[Dict[str, Any]] = []
    notes: Optional[str] = None


class PayrollItemUpdate(BaseModel):
    gross_wages: Optional[Decimal] = None
    payg_withheld: Optional[Decimal] = None
    super_amount: Optional[Decimal] = None
    net_pay: Optional[Decimal] = None
    project_allocations: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None


class PayrollItemResponse(BaseModel):
    id: UUID
    payroll_run_id: UUID
    employee_id: UUID
    gross_wages: Decimal
    payg_withheld: Decimal
    super_contribution: Decimal
    project_allocations: List[Dict[str, Any]]
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class PayrollItemWithEmployeeResponse(PayrollItemResponse):
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None


# Payroll Run Schemas
class PayrollRunBase(BaseModel):
    pay_date: date
    period_start: date
    period_end: date
    notes: Optional[str] = None


class PayrollRunCreate(PayrollRunBase):
    items: List[PayrollItemCreate] = []


class PayrollRunUpdate(BaseModel):
    pay_date: Optional[date] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    notes: Optional[str] = None


class PayrollRunResponse(PayrollRunBase):
    id: UUID
    total_gross: Decimal
    total_payg: Decimal
    total_super: Decimal
    created_by: UUID
    created_at: datetime
    items: List[PayrollItemResponse] = []

    class Config:
        from_attributes = True


class PayrollRunListResponse(PayrollRunBase):
    id: UUID
    total_gross: Decimal
    total_payg: Decimal
    total_super: Decimal
    created_by: UUID
    created_at: datetime
    item_count: int = 0

    class Config:
        from_attributes = True


# PAYG Summary Schema
class PaygMonthlySummary(BaseModel):
    month: int
    month_name: str
    year: int
    total_gross: Decimal
    total_payg_withheld: Decimal
    total_super: Decimal
    employee_count: int


# CSV Import Schema
class PayrollImportResult(BaseModel):
    success: bool
    run_id: Optional[UUID] = None
    items_created: int
    errors: List[str] = []
