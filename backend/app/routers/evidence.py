import uuid
from typing import Optional, List
from pathlib import Path

from fastapi import (
    APIRouter, 
    Depends, 
    HTTPException, 
    status, 
    UploadFile, 
    File, 
    Form, 
    Query
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.evidence_file import LinkedType
from app.schemas.evidence import EvidenceFileResponse, EvidenceFilter
from app.schemas.common import PaginatedResponse
from app.services.evidence import evidence_service
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/evidence", tags=["Evidence"])


@router.post("/upload", response_model=EvidenceFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_evidence(
    file: UploadFile = File(...),
    linked_type: LinkedType = Form(...),
    linked_id: uuid.UUID = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a new evidence file.
    
    - **file**: The file to upload
    - **linked_type**: Type of entity this evidence is linked to (transaction, payroll, project, activity)
    - **linked_id**: UUID of the linked entity
    - **description**: Optional description of the evidence
    - **tags**: Optional comma-separated tags
    """
    # Parse tags from comma-separated string
    tag_list = None
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    
    try:
        evidence = await evidence_service.upload(
            db=db,
            file=file,
            linked_type=linked_type,
            linked_id=linked_id,
            description=description,
            tags=tag_list,
            user_id=current_user.id
        )
        db.commit()
        db.refresh(evidence)
        return evidence
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/", response_model=PaginatedResponse[EvidenceFileResponse])
def list_evidence(
    linked_type: Optional[LinkedType] = Query(None),
    linked_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List evidence files with optional filtering.
    
    - **linked_type**: Filter by linked entity type
    - **linked_id**: Filter by linked entity ID
    - **page**: Page number (1-indexed)
    - **page_size**: Items per page (max 100)
    """
    filters = {}
    if linked_type:
        filters["linked_type"] = linked_type
    if linked_id:
        filters["linked_id"] = linked_id
    
    result = evidence_service.get_list(
        db=db,
        filters=filters if filters else None,
        page=page,
        page_size=page_size
    )
    
    return result


@router.get("/{evidence_id}", response_model=EvidenceFileResponse)
def get_evidence(
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get metadata for a specific evidence file.
    
    - **evidence_id**: UUID of the evidence file
    """
    evidence = evidence_service.get_by_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found"
        )
    return evidence


@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download an evidence file.
    
    - **evidence_id**: UUID of the evidence file to download
    """
    evidence = evidence_service.get_by_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found"
        )
    
    file_path = evidence_service.get_download_path(db, evidence_id)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on storage"
        )
    
    return FileResponse(
        path=str(file_path),
        filename=evidence.filename,
        media_type=evidence.file_type or "application/octet-stream"
    )


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_evidence(
    evidence_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Delete an evidence file (admin only).
    
    - **evidence_id**: UUID of the evidence file to delete
    """
    evidence = evidence_service.get_by_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence file not found"
        )
    
    success = evidence_service.delete(db, evidence_id, user_id=admin.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete evidence file"
        )
    
    db.commit()
    return None
