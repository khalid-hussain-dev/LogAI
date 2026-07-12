"""
Integration service for alert delivery configuration.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_integration import AlertIntegration


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _normalize_recipients(value: str | None) -> str | None:
    if value is None:
        return None
    parts = [item.strip() for item in value.split(",") if item.strip()]
    return ", ".join(parts) if parts else None


async def get_or_create_alert_integration(
    db: AsyncSession,
    owner_id: uuid.UUID,
) -> AlertIntegration:
    """Return the user's alert settings row, creating one if needed."""
    result = await db.execute(
        select(AlertIntegration).where(AlertIntegration.owner_id == owner_id)
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        integration = AlertIntegration(owner_id=owner_id)
        db.add(integration)
        await db.flush()
    return integration


async def update_alert_integration(
    db: AsyncSession,
    owner_id: uuid.UUID,
    *,
    slack_enabled: bool,
    slack_webhook_url: str | None,
    email_enabled: bool,
    email_recipients: str | None,
    webhook_enabled: bool,
    webhook_url: str | None,
    minimum_anomaly_score: float,
) -> AlertIntegration:
    """Update and validate the user's alert settings."""
    integration = await get_or_create_alert_integration(db, owner_id)

    slack_webhook_url = _normalize_optional(slack_webhook_url)
    email_recipients = _normalize_recipients(email_recipients)
    webhook_url = _normalize_optional(webhook_url)

    if slack_enabled and not slack_webhook_url:
        raise ValueError("Slack notifications require a webhook URL.")
    if webhook_enabled and not webhook_url:
        raise ValueError("Webhook notifications require a destination URL.")

    integration.slack_enabled = slack_enabled
    integration.slack_webhook_url = slack_webhook_url
    integration.email_enabled = email_enabled
    integration.email_recipients = email_recipients
    integration.webhook_enabled = webhook_enabled
    integration.webhook_url = webhook_url
    integration.minimum_anomaly_score = minimum_anomaly_score

    await db.flush()
    return integration
