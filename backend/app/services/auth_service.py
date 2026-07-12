"""
Auth service — signup, login, refresh, and OAuth user upsert.

This is the ONLY place where password hashing, JWT creation, and user
lookup logic live. Routes call these functions, never the DB directly.
"""

import uuid
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import AuthProvider, User
from app.schemas.auth import UserResponse


async def signup(
    db: AsyncSession,
    name: str,
    email: str,
    password: str,
) -> Tuple[str, str, UserResponse]:
    """
    Register a new local user.

    Returns: (access_token, refresh_token, UserResponse)
    Raises ValueError if email already exists.
    """
    # Check for existing user
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("Email already registered")

    user = User(
        name=name,
        email=email,
        hashed_password=hash_password(password),
        auth_provider=AuthProvider.LOCAL,
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    user_resp = _user_to_response(user)

    return access_token, refresh_token, user_resp


async def login(
    db: AsyncSession,
    email: str,
    password: str,
) -> Tuple[str, str, UserResponse]:
    """
    Authenticate a local user with email + password.

    Returns: (access_token, refresh_token, UserResponse)
    Raises ValueError if credentials are invalid.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.hashed_password is None:
        raise ValueError("Invalid email or password")

    if not verify_password(password, user.hashed_password):
        raise ValueError("Invalid email or password")

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    user_resp = _user_to_response(user)

    return access_token, refresh_token, user_resp


async def refresh(
    db: AsyncSession,
    refresh_token_str: str,
) -> str:
    """
    Issue a new access token from a valid refresh token.

    Returns: new access_token string.
    Raises ValueError if the refresh token is invalid.
    """
    payload = decode_token(refresh_token_str)
    if payload is None or payload.get("type") != "refresh":
        raise ValueError("Invalid or expired refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    return create_access_token(subject=str(user.id))


async def upsert_oauth_user(
    db: AsyncSession,
    oauth_id: str,
    provider: AuthProvider,
    name: str,
    email: str,
    picture: Optional[str] = None,
) -> Tuple[str, str, UserResponse]:
    """
    Find or create a user from an OAuth provider.
    Used by the Node.js auth-service after successful OAuth dance.

    Returns: (access_token, refresh_token, UserResponse)
    """
    # Try to find by oauth_id + provider first
    result = await db.execute(
        select(User).where(User.oauth_id == oauth_id, User.auth_provider == provider)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # Try by email (user might have signed up locally, now using OAuth)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            # Brand new user
            user = User(
                name=name,
                email=email,
                auth_provider=provider,
                oauth_id=oauth_id,
                picture=picture,
            )
            db.add(user)
        else:
            # Link existing email user to OAuth
            user.oauth_id = oauth_id
            user.auth_provider = provider
            if picture:
                user.picture = picture

        await db.flush()
    else:
        # Update profile picture if changed
        if picture and user.picture != picture:
            user.picture = picture
            await db.flush()

    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    user_resp = _user_to_response(user)

    return access_token, refresh_token, user_resp


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[UserResponse]:
    """Get user public profile by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    return _user_to_response(user)


def _user_to_response(user: User) -> UserResponse:
    """Convert ORM User to public response schema."""
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        picture=user.picture,
        auth_provider=user.auth_provider.value,
    )

