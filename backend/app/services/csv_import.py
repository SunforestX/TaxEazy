import csv
import io
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional, List, Dict, Any
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.transaction import Transaction, RdRelevance
from app.models.supplier import Supplier, Category, GstTreatment
from app.schemas.transaction import CsvImportResult, CsvRowError


class CsvImportService:
    """Service class for importing transactions from CSV files."""
    
    # Expected CSV columns
    REQUIRED_COLUMNS = ["date", "description", "amount"]
    OPTIONAL_COLUMNS = [
        "gst_amount", "account_code", "reference", 
        "supplier_name", "category", "gst_treatment"
    ]
    
    # Category mapping (case-insensitive)
    CATEGORY_MAP = {cat.value.lower(): cat for cat in Category}
    
    # GST Treatment mapping (case-insensitive)
    GST_TREATMENT_MAP = {gst.value.lower(): gst for gst in GstTreatment}
    
    def __init__(self):
        self.errors: List[CsvRowError] = []
        self.imported_count = 0
    
    def _parse_date(self, date_str: str) -> Optional[datetime.date]:
        """Parse date string in various formats."""
        if not date_str:
            return None
        
        date_formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%m/%d/%Y",
            "%d/%m/%y",
            "%Y/%m/%d",
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except ValueError:
                continue
        
        return None
    
    def _parse_decimal(self, value: str) -> Optional[Decimal]:
        """Parse decimal value, handling currency formats."""
        if not value:
            return None
        
        # Remove currency symbols and whitespace
        cleaned = value.strip().replace("$", "").replace(",", "").replace(" ", "")
        
        try:
            return Decimal(cleaned)
        except InvalidOperation:
            return None
    
    def _parse_category(self, value: str) -> Optional[Category]:
        """Parse category string to Category enum."""
        if not value:
            return None
        
        value_lower = value.strip().lower()
        
        # Direct match
        if value_lower in self.CATEGORY_MAP:
            return self.CATEGORY_MAP[value_lower]
        
        # Try to match by replacing spaces with underscores
        value_normalized = value_lower.replace(" ", "_")
        if value_normalized in self.CATEGORY_MAP:
            return self.CATEGORY_MAP[value_normalized]
        
        return None
    
    def _parse_gst_treatment(self, value: str) -> Optional[GstTreatment]:
        """Parse GST treatment string to GstTreatment enum."""
        if not value:
            return None
        
        value_clean = value.strip().lower()
        
        # Direct match
        if value_clean in self.GST_TREATMENT_MAP:
            return self.GST_TREATMENT_MAP[value_clean]
        
        return None
    
    def _find_supplier_by_name(self, db: Session, supplier_name: str) -> Optional[uuid.UUID]:
        """Find supplier ID by name (case-insensitive partial match)."""
        if not supplier_name:
            return None
        
        supplier = db.query(Supplier).filter(
            Supplier.name.ilike(f"%{supplier_name.strip()}%")
        ).first()
        
        return supplier.id if supplier else None
    
    def _validate_row(self, row: Dict[str, str], row_number: int) -> Optional[Dict[str, Any]]:
        """
        Validate and parse a CSV row.
        
        Args:
            row: Dictionary of column names to values
            row_number: Row number for error reporting
        
        Returns:
            Parsed data dictionary or None if validation fails
        """
        errors = []
        parsed_data = {}
        
        # Validate required fields
        date_str = row.get("date", "").strip()
        if not date_str:
            errors.append("Date is required")
        else:
            parsed_date = self._parse_date(date_str)
            if parsed_date is None:
                errors.append(f"Invalid date format: '{date_str}'")
            else:
                parsed_data["date"] = parsed_date
        
        description = row.get("description", "").strip()
        if not description:
            errors.append("Description is required")
        else:
            parsed_data["description"] = description
        
        amount_str = row.get("amount", "").strip()
        if not amount_str:
            errors.append("Amount is required")
        else:
            amount = self._parse_decimal(amount_str)
            if amount is None:
                errors.append(f"Invalid amount: '{amount_str}'")
            elif amount <= 0:
                errors.append("Amount must be greater than 0")
            else:
                parsed_data["amount"] = amount
        
        # Parse optional fields
        gst_amount_str = row.get("gst_amount", "").strip()
        if gst_amount_str:
            gst_amount = self._parse_decimal(gst_amount_str)
            if gst_amount is None:
                errors.append(f"Invalid GST amount: '{gst_amount_str}'")
            elif gst_amount < 0:
                errors.append("GST amount cannot be negative")
            else:
                parsed_data["gst_amount"] = gst_amount
        
        account_code = row.get("account_code", "").strip()
        if account_code:
            parsed_data["account_code"] = account_code
        
        reference = row.get("reference", "").strip()
        if reference:
            parsed_data["reference"] = reference
        
        # Store supplier name for later lookup
        supplier_name = row.get("supplier_name", "").strip()
        if supplier_name:
            parsed_data["_supplier_name"] = supplier_name
        
        # Parse category
        category_str = row.get("category", "").strip()
        if category_str:
            category = self._parse_category(category_str)
            if category is None:
                errors.append(f"Invalid category: '{category_str}'")
            else:
                parsed_data["category"] = category
        
        # Parse GST treatment
        gst_treatment_str = row.get("gst_treatment", "").strip()
        if gst_treatment_str:
            gst_treatment = self._parse_gst_treatment(gst_treatment_str)
            if gst_treatment is None:
                errors.append(f"Invalid GST treatment: '{gst_treatment_str}'")
            else:
                parsed_data["gst_treatment"] = gst_treatment
        
        # If there are errors, add them and return None
        if errors:
            self.errors.append(CsvRowError(
                row_number=row_number,
                error="; ".join(errors)
            ))
            return None
        
        return parsed_data
    
    async def import_transactions(
        self,
        db: Session,
        csv_file: UploadFile,
        user_id: uuid.UUID
    ) -> CsvImportResult:
        """
        Import transactions from a CSV file.
        
        Expected CSV columns:
        - date (required): Transaction date (YYYY-MM-DD, DD/MM/YYYY, etc.)
        - description (required): Transaction description
        - amount (required): Transaction amount
        - gst_amount (optional): GST amount
        - account_code (optional): Account code
        - reference (optional): Reference number
        - supplier_name (optional): Supplier name (will try to match)
        - category (optional): Category (Equipment, Consumables, etc.)
        - gst_treatment (optional): GST treatment (CAP, EXP, FRE, etc.)
        
        Args:
            db: SQLAlchemy session
            csv_file: Uploaded CSV file
            user_id: UUID of the importing user
        
        Returns:
            CsvImportResult with import statistics
        """
        self.errors = []
        self.imported_count = 0
        
        # Read file content
        content = await csv_file.read()
        await csv_file.seek(0)
        
        # Detect encoding and decode
        try:
            text_content = content.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text_content = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text_content = content.decode("iso-8859-1")
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(text_content))
        
        # Validate headers
        if not csv_reader.fieldnames:
            return CsvImportResult(
                imported_count=0,
                error_count=1,
                errors=[CsvRowError(row_number=1, error="CSV file is empty or has no headers")]
            )
        
        fieldnames_lower = [f.lower().strip() for f in csv_reader.fieldnames]
        
        # Check for required columns
        missing_required = []
        for col in self.REQUIRED_COLUMNS:
            if col not in fieldnames_lower:
                missing_required.append(col)
        
        if missing_required:
            return CsvImportResult(
                imported_count=0,
                error_count=1,
                errors=[CsvRowError(
                    row_number=1,
                    error=f"Missing required columns: {', '.join(missing_required)}"
                )]
            )
        
        # Create mapping of normalized column names to original
        column_map = {f.lower().strip(): f for f in csv_reader.fieldnames}
        
        # Process rows
        row_number = 2  # Start at 2 (1 is header)
        for row in csv_reader:
            # Normalize row keys to lowercase
            normalized_row = {
                key.lower().strip(): value 
                for key, value in row.items()
            }
            
            parsed_data = self._validate_row(normalized_row, row_number)
            
            if parsed_data:
                # Look up supplier if name provided
                supplier_name = parsed_data.pop("_supplier_name", None)
                if supplier_name:
                    supplier_id = self._find_supplier_by_name(db, supplier_name)
                    if supplier_id:
                        parsed_data["supplier_id"] = supplier_id
                
                # Set created_by
                parsed_data["created_by"] = user_id
                
                # Set default rd_relevance
                parsed_data["rd_relevance"] = RdRelevance.NO
                
                try:
                    transaction = Transaction(**parsed_data)
                    db.add(transaction)
                    self.imported_count += 1
                except Exception as e:
                    self.errors.append(CsvRowError(
                        row_number=row_number,
                        error=f"Failed to create transaction: {str(e)}"
                    ))
            
            row_number += 1
        
        return CsvImportResult(
            imported_count=self.imported_count,
            error_count=len(self.errors),
            errors=self.errors
        )


# Create a singleton instance
csv_import_service = CsvImportService()
