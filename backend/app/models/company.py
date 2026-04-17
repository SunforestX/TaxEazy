import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Company(Base):
    __tablename__ = "company"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, default="SunForest X Therapeutics Pty. Ltd.")
    abn = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    contact_email = Column(String(255), nullable=True, default="hello@sunforestx.com.au")
    financial_year_end = Column(String(5), nullable=False, default="06-30")
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Company(id={self.id}, name={self.name})>"
