"""Xero accounting integration implementation."""

import base64
import logging
from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.integration import Integration, IntegrationStatus as IntegrationStatusModel
from app.services.integrations.base import (
    AccountingIntegration,
    IntegrationStatus,
    SyncResult
)

logger = logging.getLogger(__name__)


class XeroIntegration(AccountingIntegration):
    """
    Xero accounting system integration.
    
    Implements OAuth2 authentication and API operations for Xero.
    """
    
    XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
    XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
    XERO_CONNECTIONS_URL = "https://api.xero.com/connections"
    
    def __init__(self):
        super().__init__(provider="xero")
        self.settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = None
    
    def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client
    
    def _get_basic_auth_header(self) -> str:
        """Generate Basic auth header for token requests."""
        credentials = f"{self.settings.xero_client_id}:{self.settings.xero_client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def get_auth_url(self) -> str:
        """
        Generate Xero OAuth2 authorization URL.
        
        Returns:
            Authorization URL for user to visit
        """
        scopes = self.settings.xero_scopes or "accounting.transactions accounting.contacts offline_access"
        
        params = {
            "response_type": "code",
            "client_id": self.settings.xero_client_id,
            "redirect_uri": self.settings.xero_redirect_uri,
            "scope": scopes,
            "state": "xero_auth",  # Should be random in production
        }
        
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.XERO_AUTH_URL}?{query_string}"
    
    async def handle_callback(self, db: Session, code: str) -> IntegrationStatus:
        """
        Handle OAuth2 callback and exchange code for tokens.
        
        Args:
            db: Database session
            code: Authorization code from Xero
            
        Returns:
            IntegrationStatus indicating connection result
        """
        try:
            client = self._get_client()
            
            # Exchange code for tokens
            token_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.settings.xero_redirect_uri,
            }
            
            headers = {
                "Authorization": self._get_basic_auth_header(),
                "Content-Type": "application/x-www-form-urlencoded",
            }
            
            response = await client.post(
                self.XERO_TOKEN_URL,
                data=token_data,
                headers=headers
            )
            response.raise_for_status()
            
            token_response = response.json()
            access_token = token_response.get("access_token")
            refresh_token = token_response.get("refresh_token")
            expires_in = token_response.get("expires_in", 1800)
            
            # Get tenant ID (organization)
            tenant_id = await self._get_tenant_id(access_token)
            
            if not tenant_id:
                return IntegrationStatus(
                    connected=False,
                    provider="xero",
                    status="error",
                    error_message="No Xero organization found"
                )
            
            # Store or update integration record
            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()
            
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            if integration:
                integration.access_token_encrypted = access_token
                integration.refresh_token_encrypted = refresh_token
                integration.tenant_id = tenant_id
                integration.token_expires_at = token_expires_at
                integration.status = IntegrationStatusModel.CONNECTED
                integration.updated_at = datetime.utcnow()
            else:
                integration = Integration(
                    provider="xero",
                    access_token_encrypted=access_token,
                    refresh_token_encrypted=refresh_token,
                    tenant_id=tenant_id,
                    token_expires_at=token_expires_at,
                    status=IntegrationStatusModel.CONNECTED,
                )
                db.add(integration)
            
            db.commit()
            
            logger.info(f"Xero integration connected successfully. Tenant: {tenant_id}")
            
            return IntegrationStatus(
                connected=True,
                provider="xero",
                status="connected",
                tenant_name=tenant_id
            )
            
        except httpx.HTTPError as e:
            logger.error(f"Xero OAuth error: {str(e)}")
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="error",
                error_message=f"HTTP error during authentication: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Xero connection error: {str(e)}")
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="error",
                error_message=str(e)
            )
    
    async def _get_tenant_id(self, access_token: str) -> Optional[str]:
        """Get the first available tenant (organization) ID."""
        try:
            client = self._get_client()
            headers = {"Authorization": f"Bearer {access_token}"}
            
            response = await client.get(
                self.XERO_CONNECTIONS_URL,
                headers=headers
            )
            response.raise_for_status()
            
            connections = response.json()
            if connections and len(connections) > 0:
                return connections[0].get("tenantId")
            
            return None
        except Exception as e:
            logger.error(f"Error getting Xero tenant: {str(e)}")
            return None
    
    def connect(self, db: Session, auth_code: str) -> IntegrationStatus:
        """Synchronous wrapper for connect (not used directly for Xero)."""
        # This is a placeholder - use handle_callback for the actual OAuth flow
        return IntegrationStatus(
            connected=False,
            provider="xero",
            status="error",
            error_message="Use handle_callback for Xero OAuth flow"
        )
    
    def disconnect(self, db: Session) -> bool:
        """
        Disconnect from Xero by clearing tokens.
        
        Args:
            db: Database session
            
        Returns:
            True if disconnected successfully
        """
        try:
            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()
            
            if integration:
                integration.access_token_encrypted = None
                integration.refresh_token_encrypted = None
                integration.tenant_id = None
                integration.token_expires_at = None
                integration.status = IntegrationStatusModel.DISCONNECTED
                integration.updated_at = datetime.utcnow()
                db.commit()
            
            logger.info("Xero integration disconnected")
            return True
            
        except Exception as e:
            logger.error(f"Error disconnecting Xero: {str(e)}")
            return False
    
    def sync_transactions(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync transactions from Xero (placeholder implementation).
        
        Args:
            db: Database session
            since_date: Optional date to sync from
            
        Returns:
            SyncResult with sync details
        """
        synced_at = datetime.utcnow()
        
        try:
            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()
            
            if not integration or integration.status != IntegrationStatusModel.CONNECTED:
                return SyncResult(
                    success=False,
                    items_synced=0,
                    errors=["Xero integration not connected"],
                    sync_type="transactions",
                    synced_at=synced_at
                )
            
            # Update last sync timestamp
            integration.last_sync_at = synced_at
            integration.updated_at = synced_at
            db.commit()
            
            logger.info(f"Transaction sync initiated at {synced_at}")
            
            # Placeholder: actual implementation would fetch from Xero API
            return SyncResult(
                success=True,
                items_synced=0,
                errors=[],
                sync_type="transactions",
                synced_at=synced_at,
                details={"message": "Transaction sync placeholder - not yet implemented"}
            )
            
        except Exception as e:
            logger.error(f"Error syncing transactions: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="transactions",
                synced_at=synced_at
            )
    
    def sync_invoices(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync invoices from Xero (placeholder implementation).
        
        Args:
            db: Database session
            since_date: Optional date to sync from
            
        Returns:
            SyncResult with sync details
        """
        synced_at = datetime.utcnow()
        
        try:
            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()
            
            if not integration or integration.status != IntegrationStatusModel.CONNECTED:
                return SyncResult(
                    success=False,
                    items_synced=0,
                    errors=["Xero integration not connected"],
                    sync_type="invoices",
                    synced_at=synced_at
                )
            
            # Update last sync timestamp
            integration.last_sync_at = synced_at
            integration.updated_at = synced_at
            db.commit()
            
            logger.info(f"Invoice sync initiated at {synced_at}")
            
            # Placeholder: actual implementation would fetch from Xero API
            return SyncResult(
                success=True,
                items_synced=0,
                errors=[],
                sync_type="invoices",
                synced_at=synced_at,
                details={"message": "Invoice sync placeholder - not yet implemented"}
            )
            
        except Exception as e:
            logger.error(f"Error syncing invoices: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="invoices",
                synced_at=synced_at
            )
    
    def sync_contacts(self, db: Session) -> SyncResult:
        """
        Sync contacts from Xero (placeholder implementation).
        
        Args:
            db: Database session
            
        Returns:
            SyncResult with sync details
        """
        synced_at = datetime.utcnow()
        
        try:
            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()
            
            if not integration or integration.status != IntegrationStatusModel.CONNECTED:
                return SyncResult(
                    success=False,
                    items_synced=0,
                    errors=["Xero integration not connected"],
                    sync_type="contacts",
                    synced_at=synced_at
                )
            
            # Update last sync timestamp
            integration.last_sync_at = synced_at
            integration.updated_at = synced_at
            db.commit()
            
            logger.info(f"Contact sync initiated at {synced_at}")
            
            # Placeholder: actual implementation would fetch from Xero API
            return SyncResult(
                success=True,
                items_synced=0,
                errors=[],
                sync_type="contacts",
                synced_at=synced_at,
                details={"message": "Contact sync placeholder - not yet implemented"}
            )
            
        except Exception as e:
            logger.error(f"Error syncing contacts: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="contacts",
                synced_at=synced_at
            )
    
    def get_status(self, db: Session) -> IntegrationStatus:
        """
        Get the current Xero integration status.
        
        Args:
            db: Database session
            
        Returns:
            IntegrationStatus with current connection details
        """
        integration = db.query(Integration).filter(
            Integration.provider == "xero"
        ).first()
        
        if not integration:
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="disconnected"
            )
        
        # Check if token is expired
        token_expired = (
            integration.token_expires_at and 
            integration.token_expires_at < datetime.utcnow()
        )
        
        if token_expired and integration.status == IntegrationStatusModel.CONNECTED:
            integration.status = IntegrationStatusModel.ERROR
            db.commit()
        
        return IntegrationStatus(
            connected=integration.status == IntegrationStatusModel.CONNECTED,
            provider="xero",
            status=integration.status,
            last_sync_at=integration.last_sync_at,
            tenant_name=integration.tenant_id
        )
