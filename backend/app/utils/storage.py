import os
import shutil
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile

from app.config import get_settings

settings = get_settings()


class StorageService:
    """Storage service for file uploads with local filesystem backend."""
    
    def __init__(self, upload_dir: Optional[str] = None):
        self.upload_dir = Path(upload_dir or settings.upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_unique_filename(self, original_filename: str) -> str:
        """Generate a unique filename with original extension."""
        ext = Path(original_filename).suffix
        unique_name = f"{uuid.uuid4()}{ext}"
        return unique_name
    
    def _get_subdir(self, linked_type: str) -> Path:
        """Get subdirectory for a linked type."""
        subdir = self.upload_dir / linked_type.lower()
        subdir.mkdir(parents=True, exist_ok=True)
        return subdir
    
    async def save_file(
        self,
        file: UploadFile,
        linked_type: str,
        linked_id: str
    ) -> str:
        """Save an uploaded file and return the storage path."""
        subdir = self._get_subdir(linked_type)
        unique_filename = self._generate_unique_filename(file.filename or "unnamed")
        file_path = subdir / unique_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return str(file_path.relative_to(self.upload_dir))
    
    def get_file_path(self, storage_path: str) -> Path:
        """Get the full file path from a storage path."""
        return self.upload_dir / storage_path
    
    def delete_file(self, storage_path: str) -> bool:
        """Delete a file by its storage path."""
        file_path = self.get_file_path(storage_path)
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    
    def get_file_size(self, storage_path: str) -> Optional[int]:
        """Get file size in bytes."""
        file_path = self.get_file_path(storage_path)
        if file_path.exists():
            return file_path.stat().st_size
        return None


# Global storage instance
storage = StorageService()
