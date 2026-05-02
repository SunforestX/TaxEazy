from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import csv
import io

from app.database import get_db
from app.models.user import User
from app.schemas.report import (
    MonthlyReportResponse,
    RdSummaryResponse,
    ComplianceStatusResponse
)
from app.services.reporting import reporting_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/monthly", response_model=MonthlyReportResponse)
def get_monthly_report(
    request: Request,
    year: int = Query(..., ge=2000, le=2100, description="Report year"),
    month: int = Query(..., ge=1, le=12, description="Report month (1-12)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a comprehensive monthly report aggregating all financial data.

    - **year**: Report year (e.g., 2024)
    - **month**: Report month (1-12)

    Returns GST summary, PAYG summary, operating spend, R&D spend, and issue counts.
    """
    report = reporting_service.get_monthly_report(db, year, month)
    return report


@router.get("/monthly/export")
def export_monthly_report(
    request: Request,
    year: int = Query(..., ge=2000, le=2100, description="Report year"),
    month: int = Query(..., ge=1, le=12, description="Report month (1-12)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export monthly report as CSV.

    - **year**: Report year (e.g., 2024)
    - **month**: Report month (1-12)

    Returns a CSV file download with all report data.
    """
    rows = reporting_service.export_monthly_report(db, year, month)

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(["Category", "Item", "Amount", "Details"])

    # Write data rows
    for row in rows:
        writer.writerow([
            row["category"],
            row["item"],
            str(row["amount"]),
            row.get("details", "")
        ])

    # Prepare response
    output.seek(0)
    filename = f"monthly_report_{year}_{month:02d}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/rd-summary", response_model=RdSummaryResponse)
def get_rd_summary(
    request: Request,
    financial_year_start: Optional[date] = Query(
        None,
        description="Start date of the financial year (default: current FY)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get R&D spend summary for a financial year.

    - **financial_year_start**: Start date of the financial year (July 1).
      If not provided, uses the current financial year.

    Australian financial year runs July 1 - June 30.
    Returns total R&D spend, breakdown by project, and breakdown by category.
    """
    # Determine financial year start if not provided
    if financial_year_start is None:
        today = date.today()
        if today.month >= 7:
            financial_year_start = date(today.year, 7, 1)
        else:
            financial_year_start = date(today.year - 1, 7, 1)

    # Validate it's a July 1 date
    if financial_year_start.month != 7 or financial_year_start.day != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Financial year must start on July 1"
        )

    summary = reporting_service.get_rd_summary(db, financial_year_start)
    return summary


def _resolve_financial_year_dates(
    start_date: Optional[date],
    end_date: Optional[date],
) -> tuple[date, date]:
    """Return (start, end) defaulting to current Australian FY (1 Jul – 30 Jun)."""
    if start_date is None or end_date is None:
        today = date.today()
        if today.month >= 7:
            fy_start = date(today.year, 7, 1)
            fy_end = date(today.year + 1, 6, 30)
        else:
            fy_start = date(today.year - 1, 7, 1)
            fy_end = date(today.year, 6, 30)
        start_date = start_date or fy_start
        end_date = end_date or fy_end
    return start_date, end_date


@router.get("/rd-summary/export")
def export_rd_summary(
    request: Request,
    format: str = Query("csv", description="Export format: csv or pdf"),
    start_date: Optional[date] = Query(None, description="Start date (default: current FY start)"),
    end_date: Optional[date] = Query(None, description="End date (default: current FY end)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export R&D expenditure data as CSV or PDF.

    - **format**: `csv` or `pdf`
    - **start_date** / **end_date**: Optional date range. Defaults to current
      Australian financial year (July 1 – June 30).
    """
    resolved_start, resolved_end = _resolve_financial_year_dates(start_date, end_date)

    if format.lower() == "pdf":
        pdf_bytes = reporting_service.export_rd_pdf(db, resolved_start, resolved_end)
        fy_label = f"{resolved_start.strftime('%Y%m%d')}_{resolved_end.strftime('%Y%m%d')}"
        filename = f"rd_expenditure_{fy_label}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    else:
        csv_str = reporting_service.export_rd_csv(db, resolved_start, resolved_end)
        fy_label = f"{resolved_start.strftime('%Y%m%d')}_{resolved_end.strftime('%Y%m%d')}"
        filename = f"rd_expenditure_{fy_label}.csv"
        return StreamingResponse(
            io.BytesIO(csv_str.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )


@router.get("/compliance-status", response_model=ComplianceStatusResponse)
def get_compliance_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current compliance status overview.

    Returns BAS status, PAYG status, evidence gaps, unresolved exceptions,
    and overall compliance status (good/warning/critical).
    """
    status_data = reporting_service.get_compliance_status(db)
    return status_data
