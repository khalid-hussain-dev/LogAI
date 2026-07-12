"""
Server ORM model.

Each server has a unique API key used by external apps to ingest logs.
Belongs to a User via owner_id foreign key.
"""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base, TimestampMixin
from app.core.security import generate_api_key


class Server(Base, TimestampMixin):
    """A monitored server / application that sends logs to LogAI."""

    __tablename__ = "servers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_key: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, default=generate_api_key, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    owner = relationship("User", back_populates="servers")

    def __repr__(self) -> str:
        return f"<Server {self.name} (owner={self.owner_id})>"

