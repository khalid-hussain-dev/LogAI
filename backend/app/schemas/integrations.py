"""
Schemas for alert integration settings and test notifications.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class AlertIntegrationUpdateRequest(BaseModel):
    """Update outbound alert delivery settings."""

    slack_enabled: bool = False
    slack_webhook_url: Optional[str] = Field(default=None, max_length=1024)
    email_enabled: bool = False
    email_recipients: Optional[str] = Field(default=None, max_length=2000)
    webhook_enabled: bool = False
    webhook_url: Optional[str] = Field(default=None, max_length=1024)
    minimum_anomaly_score: float = Field(default=0.7, ge=0.0, le=1.0)


class AlertIntegrationResponse(BaseModel):
    """Stored outbound alert delivery settings plus frontend helper flags."""

    slack_enabled: bool
    slack_webhook_url: Optional[str] = None
    slack_configured: bool
    email_enabled: bool
    email_recipients: Optional[str] = None
    email_configured: bool
    email_service_ready: bool
    webhook_enabled: bool
    webhook_url: Optional[str] = None
    webhook_configured: bool
    minimum_anomaly_score: float
    connected_channels: int


class AlertTestRequest(BaseModel):
    """Trigger a test notification through one configured channel."""

    channel: Literal["slack", "email", "webhook"]
    server_name: str = Field(default="Demo Server", min_length=1, max_length=255)
    message: str = Field(
        default="Synthetic anomaly detected during integration testing.",
        min_length=1,
        max_length=500,
    )
    anomaly_score: float = Field(default=0.92, ge=0.0, le=1.0)


class AlertTestResponse(BaseModel):
    """Success response for a test notification request."""

    message: str
