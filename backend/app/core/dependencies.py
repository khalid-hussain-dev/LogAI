"""
Dependency injection — ALL FastAPI Depends() callables live here.

Provides: get_db, get_es, get_redis, get_current_user, get_server_by_api_key.
Routes never instantiate sessions or clients directly.
"""

from typing import AsyncGenerator, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import decode_token
from app.db.postgres import async_session_factory
from app.db.elasticsearch import get_es_client
from app.db.redis_client import get_redis_client
from app.models.user import User
from app.models.server import Server

# ── Security scheme ─────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ── Database session ────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session, auto-commit on success, rollback on error."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Elasticsearch client ────────────────────────────────────────────────────
async def get_es():
    """Return the shared async Elasticsearch client."""
    return get_es_client()


# ── Redis client ────────────────────────────────────────────────────────────
async def get_redis():
    """Return the shared async Redis client."""
    return get_redis_client()


# ── JWT Auth — current user ─────────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT Bearer token, return the authenticated User."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


# ── API Key Auth — server identification ────────────────────────────────────
async def get_server_by_api_key(
    x_api_key: str = Header(..., alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
) -> Server:
    """Validate x-api-key header and return the associated Server."""
    result = await db.execute(select(Server).where(Server.api_key == x_api_key))
    server = result.scalar_one_or_none()
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return server

