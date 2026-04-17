from pydantic import BaseModel
from typing import Generic, TypeVar, List, Optional
from datetime import datetime
import uuid

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None


class SuccessResponse(BaseModel):
    message: str
    id: Optional[uuid.UUID] = None
