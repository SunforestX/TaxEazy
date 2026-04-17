import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, Numeric, Date, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class BasStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALISED = "finalised"


class BasPeriod(Base):
    __tablename__ = "bas_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    gst_collected = Column(Numeric(15, 2), default=0)
    gst_paid = Column(Numeric(15, 2), default=0)
    net_gst_position = Column(Numeric(15, 2), default=0)
    status = Column(Enum(BasStatus), nullable=False, default=BasStatus.DRAFT)
    finalised_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<BasPeriod(id={self.id}, period={self.period_start} to {self.period_end})>"
