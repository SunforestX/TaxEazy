import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    is_scientist = Column(Boolean, default=False, nullable=False)
    default_project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    notes = Column(String(1000), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    default_project = relationship("Project", backref="default_employees")

    def __repr__(self):
        return f"<Employee(id={self.id}, name={self.name}, is_scientist={self.is_scientist})>"
