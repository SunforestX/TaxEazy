from typing import TypeVar, Generic, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.orm import Query

T = TypeVar('T')


class PaginationParams:
    """Pagination parameters extracted from query parameters."""
    
    def __init__(self, page: int = 1, page_size: int = 20):
        self.page = max(1, page)
        self.page_size = min(100, max(1, page_size))
    
    @property
    def offset(self) -> int:
        """Calculate the offset for SQL queries."""
        return (self.page - 1) * self.page_size


def paginate(
    db: Session,
    query,
    page: int = 1,
    page_size: int = 20
) -> dict:
    """
    Paginate a SQLAlchemy query.
    
    Args:
        db: SQLAlchemy session
        query: SQLAlchemy select query or Query object
        page: Page number (1-indexed)
        page_size: Number of items per page (max 100)
    
    Returns:
        dict with items, total, page, page_size
    """
    params = PaginationParams(page=page, page_size=page_size)
    
    # Get total count
    if isinstance(query, Query):
        total = query.count()
        items = query.offset(params.offset).limit(params.page_size).all()
    else:
        # SQLAlchemy 2.0 style select()
        count_query = select(func.count()).select_from(query.subquery())
        total = db.execute(count_query).scalar()
        
        paginated_query = query.offset(params.offset).limit(params.page_size)
        result = db.execute(paginated_query)
        items = result.scalars().all()
    
    return {
        "items": list(items),
        "total": total,
        "page": params.page,
        "page_size": params.page_size
    }


def paginate_query(
    db: Session,
    query,
    params: PaginationParams
) -> dict:
    """
    Paginate a SQLAlchemy query using PaginationParams.
    
    Args:
        db: SQLAlchemy session
        query: SQLAlchemy select query or Query object
        params: PaginationParams instance
    
    Returns:
        dict with items, total, page, page_size
    """
    return paginate(db, query, params.page, params.page_size)
