"""Abstract base class for accounting system integrations."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy.orm import Session


@dataclass
class IntegrationStatus:
    """Status of an accounting integration."""
    connected: bool
    provider: str
    status: str  # disconnected, connected, error
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None
    tenant_name: Optional[str] = None


@dataclass
class SyncResult:
    """Result of a sync operation."""
    success: bool
    items_synced: int
    errors: list[str]
    sync_type: str  # transactions, invoices, contacts
    synced_at: datetime
    details: Optional[Dict[str, Any]] = None


class AccountingIntegration(ABC):
    """
    Abstract base class for accounting system integrations.
    
    All accounting integrations (Xero, MYOB, etc.) must implement this interface.
    """
    
    def __init__(self, provider: str):
        self.provider = provider
    
    @abstractmethod
    def connect(self, db: Session, auth_code: str) -> IntegrationStatus:
        """
        Connect to the accounting system using an authorization code.
        
        Args:
            db: Database session
            auth_code: OAuth2 authorization code from the provider
            
        Returns:
            IntegrationStatus indicating connection result
        """
        pass
    
    @abstractmethod
    def disconnect(self, db: Session) -> bool:
        """
        Disconnect from the accounting system and revoke tokens.
        
        Args:
            db: Database session
            
        Returns:
            True if disconnected successfully
        """
        pass
    
    @abstractmethod
    def sync_transactions(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync transactions from the accounting system.
        
        Args:
            db: Database session
            since_date: Optional date to sync from (defaults to last sync)
            
        Returns:
            SyncResult with sync details
        """
        pass
    
    @abstractmethod
    def sync_invoices(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync invoices from the accounting system.
        
        Args:
            db: Database session
            since_date: Optional date to sync from (defaults to last sync)
            
        Returns:
            SyncResult with sync details
        """
        pass
    
    @abstractmethod
    def sync_contacts(self, db: Session) -> SyncResult:
        """
        Sync contacts (suppliers/customers) from the accounting system.
        
        Args:
            db: Database session
            
        Returns:
            SyncResult with sync details
        """
        pass
    
    @abstractmethod
    def get_status(self, db: Session) -> IntegrationStatus:
        """
        Get the current integration status.
        
        Args:
            db: Database session
            
        Returns:
            IntegrationStatus with current connection details
        """
        pass
