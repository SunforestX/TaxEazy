"""Schemas for integration endpoints."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel


class IntegrationStatus(BaseModel):
    """Schema for integration status response."""
    connected: bool
    provider: str
    status: str
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None
    tenant_name: Optional[str] = None

    class Config:
        from_attributes = True


class XeroAuthUrl(BaseModel):
    """Schema for Xero OAuth URL response."""
    auth_url: str
    provider: str = "xero"


class XeroCallbackRequest(BaseModel):
    """Schema for Xero OAuth callback request."""
    code: str
    state: Optional[str] = None


class SyncRequest(BaseModel):
    """Schema for sync request."""
    sync_type: str  # transactions, invoices, contacts, all
    since_date: Optional[str] = None  # ISO format date string


class SyncResult(BaseModel):
    """Schema for sync result response."""
    success: bool
    items_synced: int
    errors: list[str]
    sync_type: str
    synced_at: datetime
    details: Optional[Dict[str, Any]] = None


class IntegrationResponse(BaseModel):
    """Schema for integration record response."""
    id: UUID
    provider: str
    status: str
    tenant_id: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    token_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
