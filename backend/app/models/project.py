import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Date, DateTime, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scientific_rationale = Column(Text, nullable=True)
    eligibility_notes = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), nullable=False, default=ProjectStatus.PLANNING)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    budget = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Project(id={self.id}, code={self.code}, name={self.name})>"
