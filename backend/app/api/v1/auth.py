"""
Auth routes — /api/v1/auth/*

Thin handlers that delegate ALL logic to auth_service.
Never import SQLAlchemy models or build queries here.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from app.services import auth_service

router = APIRouter()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email + password."""
    try:
        access_token, refresh_token, user = await auth_service.signup(
            db, body.name, body.email, body.password
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email + password."""
    try:
        access_token, refresh_token, user = await auth_service.login(
            db, body.email, body.password
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Get a new access token using a valid refresh token."""
    try:
        access_token = await auth_service.refresh(db, body.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return AccessTokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        picture=user.picture,
        auth_provider=user.auth_provider.value,
    )


@router.post("/logout")
async def logout():
    """
    Logout — stateless endpoint.
    Frontend clears tokens on its side. No server state to destroy with JWT.
    """
    return {"message": "Logged out successfully"}

