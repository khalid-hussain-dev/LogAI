"""
User ORM model.

Supports both local email/password signup and OAuth (Google, GitHub).
The auth_provider enum distinguishes the authentication source.
"""

import enum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.postgres import Base, TimestampMixin


class AuthProvider(str, enum.Enum):
    """How the user authenticated."""
    LOCAL = "local"
    GOOGLE = "google"
    GITHUB = "github"


class User(Base, TimestampMixin):
    """Application user — local or OAuth."""

    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(
        # Store as VARCHAR (not a Postgres native ENUM) to match the initial migration
        # and avoid requiring an `authprovider` enum type in Postgres.
        Enum(
            AuthProvider,
            native_enum=False,
            length=20,
            # Store enum VALUES in DB (local/google/github), not enum NAMES (LOCAL/...)
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            validate_strings=True,
        ),
        default=AuthProvider.LOCAL,
        nullable=False,
    )
    oauth_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    servers = relationship("Server", back_populates="owner", lazy="selectin")
    server_memberships = relationship("ServerMember", back_populates="user", cascade="all, delete-orphan")
    alert_integration = relationship(
        "AlertIntegration",
        back_populates="owner",
        uselist=False,
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.auth_provider.value})>"
