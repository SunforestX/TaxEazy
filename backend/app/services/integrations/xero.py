"""Xero accounting integration implementation."""

import base64
import logging
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.integration import Integration, IntegrationStatus as IntegrationStatusModel
from app.models.supplier import Supplier, Category, GstTreatment
from app.models.transaction import Transaction
from app.utils.encryption import encrypt_token, decrypt_token
from app.services.integrations.base import (
    AccountingIntegration,
    IntegrationStatus,
    SyncResult
)

logger = logging.getLogger(__name__)

# Xero API base URL
XERO_API_BASE = "https://api.xero.com/api.xro/2.0"


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

    def _get_sync_client(self) -> httpx.Client:
        """Get a synchronous HTTP client for sync methods."""
        return httpx.Client(timeout=30.0)

    def _get_basic_auth_header(self) -> str:
        """Generate Basic auth header for token requests."""
        credentials = f"{self.settings.xero_client_id}:{self.settings.xero_client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"

    # ─── Authentication helpers ───────────────────────────────────────────

    def _get_authenticated_headers(self, db: Session) -> Dict[str, str]:
        """
        Load integration, decrypt tokens, refresh if expired, and return
        headers ready for Xero API calls.

        Raises:
            RuntimeError: If integration is not connected or tokens are missing.
        """
        integration = db.query(Integration).filter(
            Integration.provider == "xero"
        ).first()

        if not integration or integration.status != IntegrationStatusModel.CONNECTED:
            raise RuntimeError("Xero integration is not connected")

        if not integration.access_token_encrypted or not integration.refresh_token_encrypted:
            raise RuntimeError("Xero tokens are missing")

        access_token = decrypt_token(integration.access_token_encrypted)
        refresh_token = decrypt_token(integration.refresh_token_encrypted)
        tenant_id = integration.tenant_id

        # Check if token is expired (with 60-second buffer)
        if integration.token_expires_at and integration.token_expires_at < (datetime.utcnow() + timedelta(seconds=60)):
            logger.info("Xero access token expired – refreshing…")
            access_token, refresh_token, expires_in = self._refresh_token(refresh_token)

            # Persist refreshed tokens
            integration.access_token_encrypted = encrypt_token(access_token)
            integration.refresh_token_encrypted = encrypt_token(refresh_token)
            integration.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            integration.updated_at = datetime.utcnow()
            db.commit()

        return {
            "Authorization": f"Bearer {access_token}",
            "Xero-Tenant-Id": tenant_id,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _refresh_token(self, refresh_token: str) -> tuple:
        """
        Exchange a refresh token for a new access/refresh pair.

        Returns:
            (access_token, refresh_token, expires_in)
        """
        with self._get_sync_client() as client:
            response = client.post(
                self.XERO_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={
                    "Authorization": self._get_basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            response.raise_for_status()
            data = response.json()
            return (
                data["access_token"],
                data["refresh_token"],
                data.get("expires_in", 1800),
            )

    # ─── Generic Xero API GET with rate-limit retry & pagination ─────────

    def _xero_api_get(
        self,
        url: str,
        headers: Dict[str, str],
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        GET a single page from the Xero API.

        Handles 429 rate-limit responses with exponential back-off (up to 3 retries).
        Returns parsed JSON body.
        """
        params = params or {}
        max_retries = 3

        with self._get_sync_client() as client:
            for attempt in range(max_retries + 1):
                response = client.get(url, headers=headers, params=params)

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 1))
                    wait = max(retry_after, 2 ** attempt)
                    logger.warning(f"Xero 429 rate limit – waiting {wait}s (attempt {attempt + 1})")
                    time.sleep(wait)
                    continue

                response.raise_for_status()
                return response.json()

        raise RuntimeError(f"Xero API rate-limit exceeded after {max_retries} retries for {url}")

    def _xero_api_get_all_pages(
        self,
        url: str,
        headers: Dict[str, str],
        resource_key: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetch ALL pages for a paginated Xero endpoint.

        Xero uses `page` query param (1-based); returns empty list when done.
        """
        params = dict(params or {})
        all_items: List[Dict[str, Any]] = []
        page = 1

        while True:
            params["page"] = page
            data = self._xero_api_get(url, headers, params)

            items = data.get(resource_key, [])
            if not items:
                break

            all_items.extend(items)
            page += 1

        return all_items

    def _xero_api_put(
        self,
        url: str,
        headers: Dict[str, str],
        json_body: Dict[str, Any],
    ) -> Any:
        """
        PUT to the Xero API with rate-limit retry.
        """
        max_retries = 3

        with self._get_sync_client() as client:
            for attempt in range(max_retries + 1):
                response = client.put(url, headers=headers, json=json_body)

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 1))
                    wait = max(retry_after, 2 ** attempt)
                    logger.warning(f"Xero 429 rate limit on PUT – waiting {wait}s")
                    time.sleep(wait)
                    continue

                response.raise_for_status()
                return response.json()

        raise RuntimeError(f"Xero API rate-limit exceeded after {max_retries} retries for PUT {url}")

    # ─── OAuth2 Flow (existing, preserved) ───────────────────────────────

    def get_auth_url(self) -> str:
        """Generate Xero OAuth2 authorization URL."""
        scopes = self.settings.xero_scopes or "accounting.transactions accounting.contacts offline_access"

        params = {
            "response_type": "code",
            "client_id": self.settings.xero_client_id,
            "redirect_uri": self.settings.xero_redirect_uri,
            "scope": scopes,
            "state": "xero_auth",
        }

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.XERO_AUTH_URL}?{query_string}"

    async def handle_callback(self, db: Session, code: str) -> IntegrationStatus:
        """Handle OAuth2 callback and exchange code for tokens."""
        try:
            client = self._get_client()

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
                self.XERO_TOKEN_URL, data=token_data, headers=headers
            )
            response.raise_for_status()

            token_response = response.json()
            access_token = token_response.get("access_token")
            refresh_token = token_response.get("refresh_token")
            expires_in = token_response.get("expires_in", 1800)

            tenant_id = await self._get_tenant_id(access_token)

            if not tenant_id:
                return IntegrationStatus(
                    connected=False,
                    provider="xero",
                    status="error",
                    error_message="No Xero organization found",
                )

            integration = db.query(Integration).filter(
                Integration.provider == "xero"
            ).first()

            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            if integration:
                integration.access_token_encrypted = encrypt_token(access_token)
                integration.refresh_token_encrypted = encrypt_token(refresh_token)
                integration.tenant_id = tenant_id
                integration.token_expires_at = token_expires_at
                integration.status = IntegrationStatusModel.CONNECTED
                integration.updated_at = datetime.utcnow()
            else:
                integration = Integration(
                    provider="xero",
                    access_token_encrypted=encrypt_token(access_token),
                    refresh_token_encrypted=encrypt_token(refresh_token),
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
                tenant_name=tenant_id,
            )

        except httpx.HTTPError as e:
            logger.error(f"Xero OAuth error: {str(e)}")
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="error",
                error_message=f"HTTP error during authentication: {str(e)}",
            )
        except Exception as e:
            logger.error(f"Xero connection error: {str(e)}")
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="error",
                error_message=str(e),
            )

    async def _get_tenant_id(self, access_token: str) -> Optional[str]:
        """Get the first available tenant (organization) ID."""
        try:
            client = self._get_client()
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get(self.XERO_CONNECTIONS_URL, headers=headers)
            response.raise_for_status()
            connections = response.json()
            if connections and len(connections) > 0:
                return connections[0].get("tenantId")
            return None
        except Exception as e:
            logger.error(f"Error getting Xero tenant: {str(e)}")
            return None

    def connect(self, db: Session, auth_code: str) -> IntegrationStatus:
        """Synchronous wrapper – use handle_callback for the actual OAuth flow."""
        return IntegrationStatus(
            connected=False,
            provider="xero",
            status="error",
            error_message="Use handle_callback for Xero OAuth flow",
        )

    def disconnect(self, db: Session) -> bool:
        """Disconnect from Xero by clearing tokens."""
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

    # ─── Sync: Contacts → Suppliers ──────────────────────────────────────

    def sync_contacts(self, db: Session) -> SyncResult:
        """
        Sync contacts from Xero into the local Suppliers table.
        Maps Xero Contact → Supplier (upsert by xero_id).
        """
        synced_at = datetime.utcnow()
        created = 0
        updated = 0
        errors: List[str] = []

        try:
            headers = self._get_authenticated_headers(db)

            contacts = self._xero_api_get_all_pages(
                f"{XERO_API_BASE}/Contacts",
                headers,
                resource_key="Contacts",
            )

            for contact in contacts:
                try:
                    xero_contact_id = contact.get("ContactID")
                    if not xero_contact_id:
                        continue

                    name = contact.get("Name", "Unknown")
                    email = contact.get("EmailAddress")
                    tax_number = contact.get("TaxNumber")  # ABN in AU

                    # Phone – take first available
                    phones = contact.get("Phones", [])
                    phone = None
                    for p in phones:
                        number = p.get("PhoneNumber")
                        if number:
                            phone = number
                            break

                    # GST treatment from Xero TaxType
                    gst = self._map_xero_tax_type(contact.get("DefaultTax", {}).get("SalesTaxType"))

                    existing = db.query(Supplier).filter(
                        Supplier.xero_id == xero_contact_id
                    ).first()

                    if existing:
                        existing.name = name
                        if email:
                            existing.contact_info = {**(existing.contact_info or {}), "email": email, "phone": phone}
                        if tax_number:
                            existing.abn = tax_number
                        if gst:
                            existing.default_gst_treatment = gst
                        existing.updated_at = datetime.utcnow()
                        updated += 1
                    else:
                        supplier = Supplier(
                            name=name,
                            abn=tax_number,
                            xero_id=xero_contact_id,
                            contact_info={"email": email, "phone": phone},
                            default_category=Category.OTHER,
                            default_gst_treatment=gst,
                        )
                        db.add(supplier)
                        created += 1

                except Exception as e:
                    errors.append(f"Contact {contact.get('Name', '?')}: {str(e)}")

            db.commit()

            # Update last sync timestamp
            self._update_last_sync(db, synced_at)

            logger.info(f"Contact sync complete: {created} created, {updated} updated")

            return SyncResult(
                success=True,
                items_synced=created + updated,
                errors=errors,
                sync_type="contacts",
                synced_at=synced_at,
                details={"created": created, "updated": updated},
            )

        except Exception as e:
            logger.error(f"Error syncing contacts: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="contacts",
                synced_at=synced_at,
            )

    # ─── Sync: Invoices → Transactions ───────────────────────────────────

    def sync_invoices(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync authorised/paid invoices from Xero into Transactions.
        ACCPAY = expense, ACCREC = income.
        """
        synced_at = datetime.utcnow()
        created = 0
        skipped = 0
        errors: List[str] = []

        try:
            headers = self._get_authenticated_headers(db)

            params: Dict[str, Any] = {"Statuses": "AUTHORISED,PAID"}
            if since_date:
                params["where"] = f'Date >= DateTime({since_date.year},{since_date.month},{since_date.day})'

            invoices = self._xero_api_get_all_pages(
                f"{XERO_API_BASE}/Invoices",
                headers,
                resource_key="Invoices",
                params=params,
            )

            for inv in invoices:
                try:
                    xero_invoice_id = inv.get("InvoiceID")
                    if not xero_invoice_id:
                        continue

                    # Skip if already synced
                    existing = db.query(Transaction).filter(
                        Transaction.xero_id == xero_invoice_id
                    ).first()
                    if existing:
                        skipped += 1
                        continue

                    # Resolve supplier
                    supplier_id = self._resolve_supplier_id(db, inv.get("Contact", {}))

                    # Determine type
                    inv_type = inv.get("Type", "")
                    # ACCPAY = accounts payable (expense), ACCREC = accounts receivable (income)
                    is_expense = inv_type == "ACCPAY"

                    # Build description from line items
                    line_items = inv.get("LineItems", [])
                    description = "; ".join(
                        li.get("Description", "") for li in line_items if li.get("Description")
                    ) or inv.get("Reference", "") or f"Xero Invoice {inv.get('InvoiceNumber', '')}"

                    # Parse date
                    txn_date = self._parse_xero_date(inv.get("Date"))

                    total = Decimal(str(inv.get("Total", 0)))
                    gst_amount = Decimal(str(inv.get("TotalTax", 0)))
                    if is_expense:
                        total = -abs(total)

                    txn = Transaction(
                        date=txn_date,
                        supplier_id=supplier_id,
                        description=description[:500],
                        amount=total,
                        gst_amount=gst_amount,
                        xero_id=xero_invoice_id,
                        source="xero",
                    )
                    db.add(txn)
                    created += 1

                except Exception as e:
                    errors.append(f"Invoice {inv.get('InvoiceNumber', '?')}: {str(e)}")

            db.commit()
            self._update_last_sync(db, synced_at)

            logger.info(f"Invoice sync complete: {created} created, {skipped} skipped (duplicates)")

            return SyncResult(
                success=True,
                items_synced=created,
                errors=errors,
                sync_type="invoices",
                synced_at=synced_at,
                details={"created": created, "skipped": skipped},
            )

        except Exception as e:
            logger.error(f"Error syncing invoices: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="invoices",
                synced_at=synced_at,
            )

    # ─── Sync: Bank Transactions → Transactions ─────────────────────────

    def sync_transactions(self, db: Session, since_date: Optional[date] = None) -> SyncResult:
        """
        Sync bank transactions from Xero.
        SPEND = expense, RECEIVE = income.
        """
        synced_at = datetime.utcnow()
        created = 0
        skipped = 0
        errors: List[str] = []

        try:
            headers = self._get_authenticated_headers(db)

            params: Dict[str, Any] = {"Status": "AUTHORISED"}
            if since_date:
                params["where"] = f'Date >= DateTime({since_date.year},{since_date.month},{since_date.day})'

            bank_txns = self._xero_api_get_all_pages(
                f"{XERO_API_BASE}/BankTransactions",
                headers,
                resource_key="BankTransactions",
                params=params,
            )

            for bt in bank_txns:
                try:
                    xero_bt_id = bt.get("BankTransactionID")
                    if not xero_bt_id:
                        continue

                    existing = db.query(Transaction).filter(
                        Transaction.xero_id == xero_bt_id
                    ).first()
                    if existing:
                        skipped += 1
                        continue

                    supplier_id = self._resolve_supplier_id(db, bt.get("Contact", {}))

                    bt_type = bt.get("Type", "")
                    is_expense = bt_type == "SPEND"

                    line_items = bt.get("LineItems", [])
                    description = "; ".join(
                        li.get("Description", "") for li in line_items if li.get("Description")
                    ) or bt.get("Reference", "") or f"Xero Bank Txn {xero_bt_id[:8]}"

                    txn_date = self._parse_xero_date(bt.get("Date"))

                    total = Decimal(str(bt.get("Total", 0)))
                    gst_amount = Decimal(str(bt.get("TotalTax", 0)))
                    if is_expense:
                        total = -abs(total)

                    txn = Transaction(
                        date=txn_date,
                        supplier_id=supplier_id,
                        description=description[:500],
                        amount=total,
                        gst_amount=gst_amount,
                        xero_id=xero_bt_id,
                        source="xero",
                    )
                    db.add(txn)
                    created += 1

                except Exception as e:
                    errors.append(f"BankTransaction {bt.get('BankTransactionID', '?')}: {str(e)}")

            db.commit()
            self._update_last_sync(db, synced_at)

            logger.info(f"Bank transaction sync complete: {created} created, {skipped} skipped")

            return SyncResult(
                success=True,
                items_synced=created,
                errors=errors,
                sync_type="transactions",
                synced_at=synced_at,
                details={"created": created, "skipped": skipped},
            )

        except Exception as e:
            logger.error(f"Error syncing bank transactions: {str(e)}")
            return SyncResult(
                success=False,
                items_synced=0,
                errors=[str(e)],
                sync_type="transactions",
                synced_at=synced_at,
            )

    # ─── Push-back: R&D categorization to Xero ──────────────────────────

    def push_rd_categorization(self, db: Session) -> Dict[str, Any]:
        """
        Push R&D-categorized transactions back to Xero by adding an "R&D"
        tracking category to matched invoices.
        """
        pushed = 0
        errors: List[str] = []

        try:
            headers = self._get_authenticated_headers(db)

            # Find R&D-relevant Xero-sourced transactions
            rd_transactions = db.query(Transaction).filter(
                Transaction.rd_relevance == "yes",
                Transaction.source == "xero",
                Transaction.xero_id.isnot(None),
            ).all()

            if not rd_transactions:
                return {"success": True, "pushed": 0, "message": "No R&D transactions to push"}

            for txn in rd_transactions:
                try:
                    # Add tracking category "R&D" to the invoice in Xero
                    invoice_url = f"{XERO_API_BASE}/Invoices/{txn.xero_id}"

                    # Fetch current invoice to preserve existing data
                    current = self._xero_api_get(invoice_url, headers)
                    invoice_data = current.get("Invoices", [{}])[0] if current.get("Invoices") else {}

                    # Update line items with R&D tracking category
                    line_items = invoice_data.get("LineItems", [])
                    for li in line_items:
                        tracking = li.get("Tracking", [])
                        # Add R&D category if not already present
                        has_rd = any(t.get("Name") == "R&D" for t in tracking)
                        if not has_rd:
                            tracking.append({
                                "Name": "R&D",
                                "Option": "R&D Eligible",
                            })
                            li["Tracking"] = tracking

                    payload = {
                        "Invoices": [{
                            "InvoiceID": txn.xero_id,
                            "LineItems": line_items,
                        }]
                    }

                    self._xero_api_put(invoice_url, headers, payload)
                    pushed += 1

                except Exception as e:
                    errors.append(f"Transaction {txn.id} (xero_id={txn.xero_id}): {str(e)}")

            return {
                "success": len(errors) == 0,
                "pushed": pushed,
                "errors": errors,
            }

        except Exception as e:
            logger.error(f"Error pushing R&D categorization: {str(e)}")
            return {"success": False, "pushed": 0, "errors": [str(e)]}

    # ─── Status ──────────────────────────────────────────────────────────

    def get_status(self, db: Session) -> IntegrationStatus:
        """Get the current Xero integration status."""
        integration = db.query(Integration).filter(
            Integration.provider == "xero"
        ).first()

        if not integration:
            return IntegrationStatus(
                connected=False,
                provider="xero",
                status="disconnected",
            )

        token_expired = (
            integration.token_expires_at
            and integration.token_expires_at < datetime.utcnow()
        )

        if token_expired and integration.status == IntegrationStatusModel.CONNECTED:
            integration.status = IntegrationStatusModel.ERROR
            db.commit()

        return IntegrationStatus(
            connected=integration.status == IntegrationStatusModel.CONNECTED,
            provider="xero",
            status=integration.status,
            last_sync_at=integration.last_sync_at,
            tenant_name=integration.tenant_id,
        )

    # ─── Private helpers ─────────────────────────────────────────────────

    def _update_last_sync(self, db: Session, synced_at: datetime) -> None:
        """Update last_sync_at on the integration record."""
        integration = db.query(Integration).filter(
            Integration.provider == "xero"
        ).first()
        if integration:
            integration.last_sync_at = synced_at
            integration.updated_at = synced_at
            db.commit()

    def _resolve_supplier_id(self, db: Session, xero_contact: Dict[str, Any]) -> Optional[UUID]:
        """
        Look up or create a Supplier from a Xero Contact reference.
        Returns the supplier UUID or None.
        """
        contact_id = xero_contact.get("ContactID")
        if not contact_id:
            return None

        supplier = db.query(Supplier).filter(Supplier.xero_id == contact_id).first()
        if supplier:
            return supplier.id

        # Auto-create a minimal supplier stub
        supplier = Supplier(
            name=xero_contact.get("Name", "Unknown Xero Contact"),
            xero_id=contact_id,
            default_category=Category.OTHER,
        )
        db.add(supplier)
        db.flush()  # Get the ID without full commit
        return supplier.id

    @staticmethod
    def _parse_xero_date(date_str: Optional[str]) -> date:
        """
        Parse Xero date format.  Xero returns dates as either
        '/Date(epoch)/' or ISO-8601 strings.
        """
        if not date_str:
            return date.today()

        # Handle /Date(1234567890000+0000)/ format
        if date_str.startswith("/Date("):
            epoch_ms = int(date_str.split("(")[1].split("+")[0].split("-")[0].split(")")[0])
            return datetime.utcfromtimestamp(epoch_ms / 1000).date()

        # Handle ISO format
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00")).date()
        except ValueError:
            # Try plain date
            try:
                return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                return date.today()

    @staticmethod
    def _map_xero_tax_type(tax_type: Optional[str]) -> Optional[GstTreatment]:
        """Map Xero tax type codes to our GstTreatment enum."""
        if not tax_type:
            return None

        mapping = {
            "OUTPUT": GstTreatment.EXP,
            "INPUT": GstTreatment.EXP,
            "CAPEXINPUT": GstTreatment.CAP,
            "EXEMPTOUTPUT": GstTreatment.FRE,
            "EXEMPTINPUT": GstTreatment.FRE,
            "INPUTTAXED": GstTreatment.INP,
            "BASEXCLUDED": GstTreatment.NTR,
            "NONE": GstTreatment.FRE,
        }
        return mapping.get(tax_type.upper(), GstTreatment.EXP)
