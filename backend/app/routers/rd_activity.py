import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.rd_activity import RdActivity
from app.schemas.rd_activity import (
    RdActivityCreate,
    RdActivityUpdate,
    RdActivityResponse
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.rd_activity import rd_activity_service
from app.services.project import project_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/projects/{project_id}/activities", tags=["R&D Activities"])


def check_project_exists(db: Session, project_id: uuid.UUID):
    """Helper to verify project exists."""
    project = project_service.get_by_id(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    return project


@router.get("/", response_model=PaginatedResponse[RdActivityResponse])
def list_activities(
    project_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all R&D activities for a specific project with pagination.
    """
    check_project_exists(db, project_id)
    
    result = rd_activity_service.get_list_by_project(db, project_id, page, page_size)
    
    return PaginatedResponse(
        items=result["items"],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"]
    )


@router.post("/", response_model=RdActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    project_id: uuid.UUID,
    request: RdActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new R&D activity for a project (admin only).
    """
    check_project_exists(db, project_id)
    
    data = request.model_dump()
    data["created_by"] = current_user.id
    
    activity = rd_activity_service.create_for_project(
        db,
        project_id,
        data,
        user_id=current_user.id,
        ip_address=None
    )
    
    db.commit()
    db.refresh(activity)
    
    return activity


@router.patch("/{activity_id}", response_model=RdActivityResponse)
def update_activity(
    project_id: uuid.UUID,
    activity_id: uuid.UUID,
    request: RdActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update an existing R&D activity (admin only).
    """
    check_project_exists(db, project_id)
    
    data = request.model_dump(exclude_unset=True)
    
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = rd_activity_service.update_for_project(
        db,
        project_id,
        activity_id,
        data,
        user_id=current_user.id,
        ip_address=None
    )
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )
    
    db.commit()
    db.refresh(updated)
    
    return updated


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    project_id: uuid.UUID,
    activity_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete an R&D activity (admin only).
    """
    check_project_exists(db, project_id)
    
    deleted = rd_activity_service.delete_for_project(
        db,
        project_id,
        activity_id,
        user_id=current_user.id,
        ip_address=None
    )
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found"
        )
    
    db.commit()
    
    return None
