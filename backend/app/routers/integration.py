"""Integration router for accounting system connections."""

import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.auth import require_admin
from app.services.integrations.xero import XeroIntegration
from app.schemas.integration import (
    IntegrationStatus,
    XeroAuthUrl,
    XeroCallbackRequest,
    SyncRequest,
    SyncResult,
)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("/xero/auth-url", response_model=XeroAuthUrl)
async def get_xero_auth_url(
    admin: User = Depends(require_admin)
) -> XeroAuthUrl:
    """
    Get Xero OAuth2 authorization URL.
    
    Admin only. Returns the URL to redirect the user to for Xero authorization.
    """
    xero = XeroIntegration()
    auth_url = xero.get_auth_url()
    return XeroAuthUrl(auth_url=auth_url)


@router.post("/xero/callback", response_model=IntegrationStatus)
async def handle_xero_callback(
    request: XeroCallbackRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
) -> IntegrationStatus:
    """
    Handle Xero OAuth2 callback.
    
    Admin only. Exchanges the authorization code for access tokens.
    """
    xero = XeroIntegration()
    result = await xero.handle_callback(db, request.code)
    
    if not result.connected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "Failed to connect to Xero"
        )
    
    return IntegrationStatus(
        connected=result.connected,
        provider=result.provider,
        status=result.status,
        tenant_name=result.tenant_name
    )


@router.post("/xero/sync", response_model=SyncResult)
def trigger_xero_sync(
    request: SyncRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
) -> SyncResult:
    """
    Trigger sync from Xero.
    
    Admin only. Syncs data based on the sync_type parameter.
    """
    xero = XeroIntegration()
    
    # Parse since_date if provided
    since_date: Optional[datetime] = None
    if request.since_date:
        try:
            since_date = datetime.fromisoformat(request.since_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid since_date format. Use ISO format (YYYY-MM-DD)."
            )
    
    # Route to appropriate sync method
    if request.sync_type == "transactions":
        result = xero.sync_transactions(db, since_date.date() if since_date else None)
    elif request.sync_type == "invoices":
        result = xero.sync_invoices(db, since_date.date() if since_date else None)
    elif request.sync_type == "contacts":
        result = xero.sync_contacts(db)
    elif request.sync_type == "all":
        # Run all syncs and combine results
        results = [
            xero.sync_transactions(db, since_date.date() if since_date else None),
            xero.sync_invoices(db, since_date.date() if since_date else None),
            xero.sync_contacts(db),
        ]
        
        all_success = all(r.success for r in results)
        total_synced = sum(r.items_synced for r in results)
        all_errors = [err for r in results for err in r.errors]
        
        result = SyncResult(
            success=all_success,
            items_synced=total_synced,
            errors=all_errors,
            sync_type="all",
            synced_at=datetime.utcnow(),
            details={"individual_results": [
                {
                    "sync_type": r.sync_type,
                    "success": r.success,
                    "items_synced": r.items_synced
                } for r in results
            ]}
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sync_type: {request.sync_type}. Must be one of: transactions, invoices, contacts, all"
        )
    
    return SyncResult(
        success=result.success,
        items_synced=result.items_synced,
        errors=result.errors,
        sync_type=result.sync_type,
        synced_at=result.synced_at,
        details=result.details
    )


@router.get("/xero/status", response_model=IntegrationStatus)
def get_xero_status(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
) -> IntegrationStatus:
    """
    Get Xero integration status.
    
    Admin only. Returns current connection status and last sync info.
    """
    xero = XeroIntegration()
    result = xero.get_status(db)
    
    return IntegrationStatus(
        connected=result.connected,
        provider=result.provider,
        status=result.status,
        last_sync_at=result.last_sync_at,
        tenant_name=result.tenant_name
    )


@router.post("/xero/disconnect")
def disconnect_xero(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
) -> dict:
    """
    Disconnect from Xero.
    
    Admin only. Revokes tokens and clears integration settings.
    """
    xero = XeroIntegration()
    success = xero.disconnect(db)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disconnect from Xero"
        )
    
    return {"message": "Xero integration disconnected successfully"}
