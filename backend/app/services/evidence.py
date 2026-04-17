import uuid
from typing import Optional, Dict, Any, List
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import UploadFile

from app.models.evidence_file import EvidenceFile, LinkedType
from app.utils.storage import storage
from app.utils.pagination import paginate
from app.services.base import BaseService


class EvidenceService(BaseService[EvidenceFile]):
    """Service for managing evidence files."""

    def __init__(self):
        super().__init__(EvidenceFile, "evidence_file")

    async def upload(
        self,
        db: Session,
        file: UploadFile,
        linked_type: LinkedType,
        linked_id: uuid.UUID,
        description: Optional[str],
        tags: Optional[List[str]],
        user_id: uuid.UUID
    ) -> EvidenceFile:
        """
        Upload a file and create an evidence record.

        Args:
            db: SQLAlchemy session
            file: The uploaded file
            linked_type: Type of entity this evidence is linked to
            linked_id: UUID of the linked entity
            description: Optional description
            tags: Optional list of tags
            user_id: UUID of the uploading user

        Returns:
            The created EvidenceFile instance
        """
        # Save file using StorageService
        storage_path = await storage.save_file(
            file=file,
            linked_type=linked_type.value,
            linked_id=str(linked_id)
        )

        # Get file size
        file_size_bytes = storage.get_file_size(storage_path)
        file_size_str = self._format_file_size(file_size_bytes) if file_size_bytes else None

        # Create evidence record
        evidence_data = {
            "filename": file.filename or "unnamed",
            "storage_path": storage_path,
            "file_type": file.content_type,
            "file_size": file_size_str,
            "linked_type": linked_type,
            "linked_id": linked_id,
            "uploaded_by": user_id,
            "description": description,
            "tags": tags,
        }

        entity = self.create(db, evidence_data, user_id=user_id)
        db.flush()
        return entity

    def get_list(
        self,
        db: Session,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        Get a paginated list of evidence files with optional filtering.

        Args:
            db: SQLAlchemy session
            filters: Optional dictionary with linked_type and/or linked_id
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Dict with items, total, page, page_size
        """
        query = select(EvidenceFile)

        # Apply filters
        if filters:
            conditions = []
            if "linked_type" in filters and filters["linked_type"] is not None:
                conditions.append(EvidenceFile.linked_type == filters["linked_type"])
            if "linked_id" in filters and filters["linked_id"] is not None:
                conditions.append(EvidenceFile.linked_id == filters["linked_id"])
            
            if conditions:
                query = query.where(and_(*conditions))

        # Order by uploaded_at descending (newest first)
        query = query.order_by(EvidenceFile.uploaded_at.desc())

        return paginate(db, query, page, page_size)

    def get_for_entity(
        self,
        db: Session,
        linked_type: LinkedType,
        linked_id: uuid.UUID
    ) -> List[EvidenceFile]:
        """
        Get all evidence files for a specific entity.

        Args:
            db: SQLAlchemy session
            linked_type: Type of entity
            linked_id: UUID of the entity

        Returns:
            List of EvidenceFile instances
        """
        stmt = (
            select(EvidenceFile)
            .where(
                and_(
                    EvidenceFile.linked_type == linked_type,
                    EvidenceFile.linked_id == linked_id
                )
            )
            .order_by(EvidenceFile.uploaded_at.desc())
        )
        result = db.execute(stmt)
        return list(result.scalars().all())

    def delete(
        self,
        db: Session,
        evidence_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None
    ) -> bool:
        """
        Delete an evidence file and its associated storage.

        Args:
            db: SQLAlchemy session
            evidence_id: UUID of the evidence to delete
            user_id: Optional UUID of the deleting user for audit

        Returns:
            True if deleted, False if not found
        """
        evidence = self.get_by_id(db, evidence_id)
        if not evidence:
            return False

        # Delete the physical file
        storage.delete_file(evidence.storage_path)

        # Delete the database record
        return super().delete(db, evidence_id, user_id=user_id)

    def get_download_path(self, db: Session, evidence_id: uuid.UUID) -> Optional[Path]:
        """
        Get the file path for downloading an evidence file.

        Args:
            db: SQLAlchemy session
            evidence_id: UUID of the evidence

        Returns:
            Path to the file or None if not found
        """
        evidence = self.get_by_id(db, evidence_id)
        if not evidence:
            return None

        return storage.get_file_path(evidence.storage_path)

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


# Global evidence service instance
evidence_service = EvidenceService()
