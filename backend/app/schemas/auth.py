"""
Auth schemas — request and response models for authentication endpoints.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ── Requests ────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    """Body for POST /auth/signup."""
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """Body for POST /auth/login."""
    email: EmailStr
    password: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    """Body for POST /auth/refresh."""
    refresh_token: str


# ── Responses ───────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Public user information."""
    id: str
    name: str
    email: str
    picture: Optional[str] = None
    auth_provider: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """JWT token pair returned after login/signup."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AccessTokenResponse(BaseModel):
    """Single access token returned from refresh."""
    access_token: str
    token_type: str = "bearer"

