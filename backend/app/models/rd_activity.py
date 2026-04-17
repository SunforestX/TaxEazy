import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, Numeric, Date, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class RdActivity(Base):
    __tablename__ = "rd_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    activity_date = Column(Date, nullable=False)
    owner = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    hours_logged = Column(Numeric(5, 2), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", backref="activities")
    creator = relationship("User", backref="created_activities")

    def __repr__(self):
        return f"<RdActivity(id={self.id}, title={self.title}, project_id={self.project_id})>"
