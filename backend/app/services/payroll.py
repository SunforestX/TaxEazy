import uuid
import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List, BinaryIO
from sqlalchemy.orm import Session
from sqlalchemy import select, func, extract, and_

from app.services.base import BaseService
from app.models.payroll import PayrollRun, PayrollItem
from app.models.employee import Employee
from app.models.transaction import Transaction
from app.utils.pagination import paginate


# 2025-2026 Australian resident individual tax brackets
# Each tuple: (upper_threshold, marginal_rate, base_tax)
TAX_BRACKETS_2025_26 = [
    (18200, 0, 0),              # $0 - $18,200: Nil
    (45000, 0.16, 0),           # $18,201 - $45,000: 16c per $1 over $18,200
    (135000, 0.30, 4288),       # $45,001 - $135,000: $4,288 + 30c per $1 over $45,000
    (190000, 0.37, 31288),      # $135,001 - $190,000: $31,288 + 37c per $1 over $135,000
    (float('inf'), 0.45, 51638),  # $190,001+: $51,638 + 45c per $1 over $190,000
]

MEDICARE_LEVY_RATE = 0.02
SMALL_BUSINESS_TAX_RATE = 0.25


def calculate_individual_tax(annual_income: float) -> dict:
    """
    Calculate individual income tax using 2025-26 Australian resident rates.

    Args:
        annual_income: Gross annual income

    Returns:
        Dict with gross_income, tax_payable, medicare_levy, total_tax, effective_rate
    """
    if annual_income <= 0:
        return {
            "gross_income": round(annual_income, 2),
            "tax_payable": 0.0,
            "medicare_levy": 0.0,
            "total_tax": 0.0,
            "effective_rate": 0.0,
        }

    tax_payable = 0.0
    prev_threshold = 0

    for upper, rate, base_tax in TAX_BRACKETS_2025_26:
        if annual_income <= upper:
            tax_payable = base_tax + rate * (annual_income - prev_threshold)
            break
        prev_threshold = upper

    medicare_levy = annual_income * MEDICARE_LEVY_RATE
    total_tax = tax_payable + medicare_levy
    effective_rate = (total_tax / annual_income) * 100 if annual_income > 0 else 0.0

    return {
        "gross_income": round(annual_income, 2),
        "tax_payable": round(tax_payable, 2),
        "medicare_levy": round(medicare_levy, 2),
        "total_tax": round(total_tax, 2),
        "effective_rate": round(effective_rate, 2),
    }


class PayrollService(BaseService[PayrollRun]):
    """
    Service class for Payroll Run entity operations.
    
    Extends BaseService to provide CRUD operations for PayrollRun model
    with additional business logic for payroll management including
    PAYG calculations and CSV imports.
    """
    
    def __init__(self):
        super().__init__(PayrollRun, "PayrollRun")
    
    def create_run_with_items(
        self,
        db: Session,
        run_data: Dict[str, Any],
        items_data: List[Dict[str, Any]],
        user_id: uuid.UUID
    ) -> PayrollRun:
        """
        Create a payroll run with associated items in a transaction.
        
        Args:
            db: SQLAlchemy session
            run_data: Payroll run data (pay_date, period_start, period_end, notes)
            items_data: List of payroll item data
            user_id: UUID of the creating user
            
        Returns:
            The created PayrollRun instance with items
        """
        # Calculate totals from items
        total_gross = sum(item.get("gross_wages", Decimal("0")) for item in items_data)
        total_payg = sum(item.get("payg_withheld", Decimal("0")) for item in items_data)
        total_super = sum(item.get("super_amount", Decimal("0")) for item in items_data)
        
        # Create the payroll run
        run_data["total_gross"] = total_gross
        run_data["total_payg"] = total_payg
        run_data["total_super"] = total_super
        run_data["created_by"] = user_id
        
        payroll_run = PayrollRun(**run_data)
        db.add(payroll_run)
        db.flush()  # Flush to get the run ID
        
        # Create payroll items
        for item_data in items_data:
            item = PayrollItem(
                payroll_run_id=payroll_run.id,
                employee_id=item_data["employee_id"],
                gross_wages=item_data["gross_wages"],
                payg_withheld=item_data["payg_withheld"],
                super_contribution=item_data.get("super_amount", Decimal("0")),
                project_allocations=item_data.get("project_allocations", []),
                notes=item_data.get("notes")
            )
            db.add(item)
        
        db.flush()
        return payroll_run
    
    def get_run_with_items(
        self,
        db: Session,
        run_id: uuid.UUID
    ) -> Optional[PayrollRun]:
        """
        Get a payroll run with its items joined.
        
        Args:
            db: SQLAlchemy session
            run_id: UUID of the payroll run
            
        Returns:
            PayrollRun instance with items or None if not found
        """
        stmt = select(PayrollRun).where(PayrollRun.id == run_id)
        result = db.execute(stmt)
        payroll_run = result.scalar_one_or_none()
        
        if payroll_run:
            # Eager load items
            items_stmt = select(PayrollItem).where(PayrollItem.payroll_run_id == run_id)
            items_result = db.execute(items_stmt)
            payroll_run.items = items_result.scalars().all()
        
        return payroll_run
    
    def get_runs_with_date_filter(
        self,
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get paginated payroll runs with optional date filtering.
        
        Args:
            db: SQLAlchemy session
            start_date: Optional start date filter
            end_date: Optional end date filter
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            Dict with items, total, page, page_size
        """
        query = select(PayrollRun)
        
        conditions = []
        if start_date:
            conditions.append(PayrollRun.pay_date >= start_date)
        if end_date:
            conditions.append(PayrollRun.pay_date <= end_date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(PayrollRun.pay_date.desc())
        
        return paginate(db, query, page, page_size)
    
    def import_from_csv(
        self,
        db: Session,
        csv_file: BinaryIO,
        user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Import payroll data from CSV file.
        
        Expected CSV format:
        employee_id,gross_wages,payg_withheld,super_amount,project_allocations,notes
        
        Args:
            db: SQLAlchemy session
            csv_file: Binary file-like object containing CSV data
            user_id: UUID of the importing user
            
        Returns:
            Dict with success status, run_id, items_created, and any errors
        """
        errors = []
        items_data = []
        
        try:
            # Read CSV content
            content = csv_file.read().decode("utf-8")
            reader = csv.DictReader(io.StringIO(content))
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is 1)
                try:
                    # Validate required fields
                    if not row.get("employee_id"):
                        errors.append(f"Row {row_num}: Missing employee_id")
                        continue
                    
                    # Parse and validate data
                    try:
                        employee_id = uuid.UUID(row["employee_id"])
                    except ValueError:
                        errors.append(f"Row {row_num}: Invalid employee_id format")
                        continue
                    
                    # Verify employee exists
                    emp_stmt = select(Employee).where(Employee.id == employee_id)
                    emp_result = db.execute(emp_stmt)
                    if not emp_result.scalar_one_or_none():
                        errors.append(f"Row {row_num}: Employee not found: {employee_id}")
                        continue
                    
                    # Parse amounts
                    try:
                        gross_wages = Decimal(row.get("gross_wages", "0"))
                        payg_withheld = Decimal(row.get("payg_withheld", "0"))
                        super_amount = Decimal(row.get("super_amount", "0"))
                    except Exception:
                        errors.append(f"Row {row_num}: Invalid numeric value")
                        continue
                    
                    # Parse project allocations (JSON string expected)
                    project_allocations = []
                    if row.get("project_allocations"):
                        import json
                        try:
                            project_allocations = json.loads(row["project_allocations"])
                        except json.JSONDecodeError:
                            pass
                    
                    items_data.append({
                        "employee_id": employee_id,
                        "gross_wages": gross_wages,
                        "payg_withheld": payg_withheld,
                        "super_amount": super_amount,
                        "project_allocations": project_allocations,
                        "notes": row.get("notes", "")
                    })
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
            
            if not items_data:
                return {
                    "success": False,
                    "run_id": None,
                    "items_created": 0,
                    "errors": errors if errors else ["No valid data found in CSV"]
                }
            
            # Create payroll run with imported items
            today = date.today()
            run_data = {
                "pay_date": today,
                "period_start": today,
                "period_end": today,
                "notes": f"Imported from CSV on {today.isoformat()}"
            }
            
            payroll_run = self.create_run_with_items(db, run_data, items_data, user_id)
            
            return {
                "success": True,
                "run_id": payroll_run.id,
                "items_created": len(items_data),
                "errors": errors
            }
            
        except Exception as e:
            return {
                "success": False,
                "run_id": None,
                "items_created": 0,
                "errors": [str(e)]
            }
    
    def get_payg_summary(
        self,
        db: Session,
        year: int
    ) -> List[Dict[str, Any]]:
        """
        Get monthly PAYG summary for a given year.
        
        Args:
            db: SQLAlchemy session
            year: Year to summarize
            
        Returns:
            List of monthly summary dicts with totals
        """
        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        
        stmt = select(
            extract("month", PayrollRun.pay_date).label("month"),
            func.sum(PayrollRun.total_gross).label("total_gross"),
            func.sum(PayrollRun.total_payg).label("total_payg"),
            func.sum(PayrollRun.total_super).label("total_super"),
            func.count(func.distinct(PayrollItem.employee_id)).label("employee_count")
        ).join(
            PayrollItem, PayrollItem.payroll_run_id == PayrollRun.id
        ).where(
            extract("year", PayrollRun.pay_date) == year
        ).group_by(
            extract("month", PayrollRun.pay_date)
        ).order_by(
            extract("month", PayrollRun.pay_date)
        )
        
        result = db.execute(stmt)
        
        summaries = []
        for row in result:
            month = int(row.month)
            summaries.append({
                "month": month,
                "month_name": month_names[month - 1],
                "year": year,
                "total_gross": row.total_gross or Decimal("0"),
                "total_payg_withheld": row.total_payg or Decimal("0"),
                "total_super": row.total_super or Decimal("0"),
                "employee_count": row.employee_count or 0
            })
        
        return summaries
    
    def update_item_allocation(
        self,
        db: Session,
        item_id: uuid.UUID,
        project_allocations: List[Dict[str, Any]],
        user_id: Optional[uuid.UUID] = None
    ) -> Optional[PayrollItem]:
        """
        Update the project allocations for a payroll item.
        
        Args:
            db: SQLAlchemy session
            item_id: UUID of the payroll item
            project_allocations: New project allocations list
            user_id: Optional UUID of the updating user for audit
            
        Returns:
            Updated PayrollItem or None if not found
        """
        stmt = select(PayrollItem).where(PayrollItem.id == item_id)
        result = db.execute(stmt)
        item = result.scalar_one_or_none()
        
        if not item:
            return None
        
        item.project_allocations = project_allocations
        db.flush()
        
        return item


    def calculate_payg_estimate(
        self,
        db: Session,
        company_id: uuid.UUID
    ) -> Dict[str, Any]:
        """
        Calculate quarterly PAYG installment estimate for a company.

        Queries total income and deductible expenses from transactions,
        estimates taxable income, calculates company tax at the small
        business rate (25%), and derives the quarterly installment.

        Args:
            db: SQLAlchemy session
            company_id: UUID of the company

        Returns:
            Dict with PAYG estimate breakdown
        """
        today = date.today()
        # Determine current Australian financial year (1 Jul - 30 Jun)
        if today.month >= 7:
            fy_start = date(today.year, 7, 1)
            fy_end = date(today.year + 1, 6, 30)
            fy_label = f"{today.year}-{str(today.year + 1)[-2:]}"
        else:
            fy_start = date(today.year - 1, 7, 1)
            fy_end = date(today.year, 6, 30)
            fy_label = f"{today.year - 1}-{str(today.year)[-2:]}"

        # Total income: transactions with amount > 0 in the FY
        income_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.date >= fy_start,
                Transaction.date <= fy_end,
                Transaction.amount > 0,
            )
        )
        total_income = float(db.execute(income_stmt).scalar())

        # Total deductible expenses: transactions with amount < 0 (stored as negative)
        expense_stmt = select(
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0)
        ).where(
            and_(
                Transaction.date >= fy_start,
                Transaction.date <= fy_end,
                Transaction.amount < 0,
            )
        )
        total_expenses = float(db.execute(expense_stmt).scalar())

        estimated_taxable_income = max(total_income - total_expenses, 0.0)
        estimated_annual_tax = round(estimated_taxable_income * SMALL_BUSINESS_TAX_RATE, 2)
        quarterly_installment = round(estimated_annual_tax / 4, 2)

        # Employee PAYG withheld from payroll runs in the FY
        payg_stmt = select(func.coalesce(func.sum(PayrollRun.total_payg), 0)).where(
            and_(
                PayrollRun.pay_date >= fy_start,
                PayrollRun.pay_date <= fy_end,
            )
        )
        employee_payg_withheld = float(db.execute(payg_stmt).scalar())

        # Next PAYG quarterly due date
        quarterly_due_dates = [
            date(fy_start.year, 10, 28),
            date(fy_start.year + 1, 2, 28),
            date(fy_start.year + 1, 4, 28),
            date(fy_start.year + 1, 7, 28),
        ]
        next_due_date = None
        for d in quarterly_due_dates:
            if d > today:
                next_due_date = d.isoformat()
                break
        if not next_due_date:
            next_due_date = quarterly_due_dates[-1].isoformat()

        return {
            "financial_year": fy_label,
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "estimated_taxable_income": round(estimated_taxable_income, 2),
            "company_tax_rate": SMALL_BUSINESS_TAX_RATE,
            "estimated_annual_tax": estimated_annual_tax,
            "quarterly_installment": quarterly_installment,
            "employee_payg_withheld": round(employee_payg_withheld, 2),
            "next_due_date": next_due_date,
        }


# Singleton instance
payroll_service = PayrollService()
