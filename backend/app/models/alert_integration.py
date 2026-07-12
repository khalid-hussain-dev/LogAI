"""
Alert integration ORM model.

Stores a user's outbound alert delivery preferences for anomaly notifications.
"""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base, TimestampMixin


class AlertIntegration(Base, TimestampMixin):
    """Outbound alert delivery settings owned by a single user."""

    __tablename__ = "alert_integrations"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    slack_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    slack_webhook_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email_recipients: Mapped[str | None] = mapped_column(Text, nullable=True)
    webhook_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    minimum_anomaly_score: Mapped[float] = mapped_column(Float, default=0.7)

    owner = relationship("User", back_populates="alert_integration")

    def __repr__(self) -> str:
        return f"<AlertIntegration owner={self.owner_id}>"
