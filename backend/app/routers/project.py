import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.project import ProjectStatus
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetail,
    ProjectListItem
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.project import project_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/", response_model=PaginatedResponse[ProjectListItem])
def list_projects(
    status: Optional[ProjectStatus] = Query(None, description="Filter by project status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all projects with status filter and pagination.
    Includes budget vs actual spend statistics.
    """
    filters = {}
    if status:
        filters["status"] = status
    
    result = project_service.list_with_stats(db, filters, page, page_size)
    
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"]
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project details including aggregated spend and evidence status.
    """
    project = project_service.get_detail(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    request: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new R&D project (admin only).
    """
    # Check if code already exists
    from sqlalchemy import select
    from app.models.project import Project
    
    stmt = select(Project).where(Project.code == request.code)
    existing = db.execute(stmt).scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with code '{request.code}' already exists"
        )
    
    data = request.model_dump()
    project = project_service.create(
        db,
        data,
        user_id=current_user.id,
        ip_address=None  # Could extract from request if needed
    )
    
    db.commit()
    db.refresh(project)
    
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update an existing project (admin only).
    """
    project = project_service.get_by_id(db, project_id)
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    data = request.model_dump(exclude_unset=True)
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = project_service.update(
        db,
        project_id,
        data,
        user_id=current_user.id,
        ip_address=None
    )
    
    db.commit()
    db.refresh(updated)
    
    return updated


@router.get("/{project_id}/spend-summary")
def get_spend_summary(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get spend breakdown by category for a project.
    Categories: salaries, cro_contractor, consumables, equipment, other
    """
    summary = project_service.get_spend_summary(db, project_id)
    
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return summary


@router.get("/{project_id}/evidence-status")
def get_evidence_status(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get evidence completeness status for a project.
    Checks: has activities, has transactions, has evidence files.
    """
    evidence_status = project_service.get_evidence_status(db, project_id)
    
    if not evidence_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return evidence_status
