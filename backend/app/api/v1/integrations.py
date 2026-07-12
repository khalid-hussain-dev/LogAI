"""
Alert integration routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.integrations import (
    AlertIntegrationResponse,
    AlertIntegrationUpdateRequest,
    AlertTestRequest,
    AlertTestResponse,
)
from app.services import integration_service, notification_service

router = APIRouter()


def _to_response(integration, user: User) -> AlertIntegrationResponse:
    email_recipients = integration.email_recipients or user.email
    email_configured = bool(notification_service.resolve_email_recipients(integration, user.email))
    return AlertIntegrationResponse(
        slack_enabled=integration.slack_enabled,
        slack_webhook_url=integration.slack_webhook_url,
        slack_configured=bool(integration.slack_webhook_url),
        email_enabled=integration.email_enabled,
        email_recipients=email_recipients,
        email_configured=email_configured,
        email_service_ready=notification_service.email_service_ready(),
        webhook_enabled=integration.webhook_enabled,
        webhook_url=integration.webhook_url,
        webhook_configured=bool(integration.webhook_url),
        minimum_anomaly_score=float(integration.minimum_anomaly_score),
        connected_channels=notification_service.configured_channels_count(integration, user.email),
    )


@router.get("/alerts", response_model=AlertIntegrationResponse)
async def get_alert_integrations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's alert delivery settings."""
    integration = await integration_service.get_or_create_alert_integration(db, user.id)
    return _to_response(integration, user)


@router.put("/alerts", response_model=AlertIntegrationResponse)
async def update_alert_integrations(
    body: AlertIntegrationUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update outbound alert delivery settings."""
    try:
        integration = await integration_service.update_alert_integration(
            db,
            user.id,
            slack_enabled=body.slack_enabled,
            slack_webhook_url=body.slack_webhook_url,
            email_enabled=body.email_enabled,
            email_recipients=body.email_recipients,
            webhook_enabled=body.webhook_enabled,
            webhook_url=body.webhook_url,
            minimum_anomaly_score=body.minimum_anomaly_score,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _to_response(integration, user)


@router.post("/alerts/test", response_model=AlertTestResponse)
async def test_alert_integration(
    body: AlertTestRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test alert through one configured channel."""
    integration = await integration_service.get_or_create_alert_integration(db, user.id)
    try:
        await notification_service.send_test_notification(
            integration,
            user,
            body.channel,
            server_name=body.server_name,
            message=body.message,
            anomaly_score=body.anomaly_score,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AlertTestResponse(message=f"Test {body.channel} notification sent.")
