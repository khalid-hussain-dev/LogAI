"""
ServerMember ORM model.

Tracks shared access permissions for a server across multiple users.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base


class ServerMember(Base):
    """Junction table mapping users to shared servers with roles."""

    __tablename__ = "server_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="viewer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    server = relationship("Server", back_populates="members")
    user = relationship("User", back_populates="server_memberships")

    __table_args__ = (
        UniqueConstraint("server_id", "user_id", name="uq_server_member"),
    )

    def __repr__(self) -> str:
        return f"<ServerMember server={self.server_id} user={self.user_id} role={self.role}>"
