import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class Category(str, enum.Enum):
    EQUIPMENT = "Equipment"
    CONSUMABLES = "Consumables"
    SERVICES = "Services"
    CRO_CONTRACT = "CRO_Contract"
    SALARIES = "Salaries"
    OVERHEADS = "Overheads"
    TRAVEL = "Travel"
    OTHER = "Other"


class GstTreatment(str, enum.Enum):
    CAP = "CAP"  # Capital
    EXP = "EXP"  # Expense
    FRE = "FRE"  # GST Free
    INP = "INP"  # Input Taxed
    NTR = "NTR"  # Not Reported
    MIX = "MIX"  # Mixed


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    abn = Column(String(20), nullable=True)
    contact_info = Column(JSON, default=dict)
    default_category = Column(Enum(Category), nullable=True)
    default_gst_treatment = Column(Enum(GstTreatment), nullable=True)
    notes = Column(String(1000), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Supplier(id={self.id}, name={self.name})>"
