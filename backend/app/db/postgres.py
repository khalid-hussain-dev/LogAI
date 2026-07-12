"""
Async SQLAlchemy engine, session factory, and Base model.

All ORM models inherit from Base which provides id + timestamps via TimestampMixin.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import settings

# ── Async Engine ────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# ── Session factory ─────────────────────────────────────────────────────────
async_session_factory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Timestamp mixin ────────────────────────────────────────────────────────
class TimestampMixin:
    """Adds created_at and updated_at columns to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )


# ── Base model ──────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Base class for all ORM models. Provides UUID primary key + timestamps."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

