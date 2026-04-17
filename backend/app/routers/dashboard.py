from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    DashboardStats,
    ComplianceReminder,
    RecentActivityItem,
    DashboardResponse
)
from app.services.dashboard import dashboard_service
from app.utils.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all dashboard statistics.
    
    Returns financial and operational statistics including:
    - Total spent this month
    - R&D eligible spend YTD
    - GST position for current quarter
    - PAYG withheld this month
    - Monthly burn rate (3-month average)
    - Unclassified transactions count
    - Missing evidence count
    - Open exceptions count
    """
    try:
        stats = dashboard_service.get_stats(db)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve dashboard stats: {str(e)}"
        )


@router.get("/compliance", response_model=List[ComplianceReminder])
def get_compliance_reminders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get compliance reminders.
    
    Returns a list of compliance reminders including:
    - BAS filing deadlines
    - PAYG recording status
    - High severity exceptions
    - Unclassified transactions
    - Missing evidence alerts
    """
    try:
        reminders = dashboard_service.get_compliance_reminders(db)
        return reminders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve compliance reminders: {str(e)}"
        )


@router.get("/recent-activity", response_model=List[RecentActivityItem])
def get_recent_activity(
    request: Request,
    limit: int = Query(10, ge=1, le=50, description="Number of activities to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get recent activity feed.
    
    Returns recent audit events with user information.
    
    - **limit**: Number of activities to return (default 10, max 50)
    """
    try:
        activities = dashboard_service.get_recent_activity(db, limit=limit)
        return activities
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve recent activity: {str(e)}"
        )


@router.get("/", response_model=DashboardResponse)
def get_full_dashboard(
    request: Request,
    activity_limit: int = Query(10, ge=1, le=50, description="Number of activities to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get complete dashboard data.
    
    Returns combined dashboard response with stats, compliance reminders, and recent activity.
    
    - **activity_limit**: Number of recent activities to include (default 10, max 50)
    """
    try:
        stats = dashboard_service.get_stats(db)
        reminders = dashboard_service.get_compliance_reminders(db)
        activities = dashboard_service.get_recent_activity(db, limit=activity_limit)
        
        return DashboardResponse(
            stats=stats,
            compliance_reminders=reminders,
            recent_activity=activities
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve dashboard data: {str(e)}"
        )
