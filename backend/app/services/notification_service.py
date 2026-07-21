"""
Notification delivery service for anomaly alerts.
"""

import asyncio
import logging
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.db.postgres import async_session_factory
from app.models.alert_integration import AlertIntegration
from app.models.server import Server
from app.models.user import User

logger = logging.getLogger(__name__)


def email_service_ready() -> bool:
    """Whether the backend has enough SMTP config to send email alerts."""
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def resolve_email_recipients(
    integration: AlertIntegration,
    fallback_email: str | None,
) -> list[str]:
    """Parse configured recipients, falling back to the user's own email."""
    if integration.email_recipients:
        recipients = [item.strip() for item in integration.email_recipients.split(",") if item.strip()]
    elif fallback_email:
        recipients = [fallback_email]
    else:
        recipients = []
    return recipients


def configured_channels_count(integration: AlertIntegration, fallback_email: str | None) -> int:
    """Count channels that are both enabled and sufficiently configured."""
    total = 0
    if integration.slack_enabled and integration.slack_webhook_url:
        total += 1
    if integration.email_enabled and email_service_ready() and resolve_email_recipients(integration, fallback_email):
        total += 1
    if integration.webhook_enabled and integration.webhook_url:
        total += 1
    return total


def _format_timestamp(timestamp: Any) -> str:
    if timestamp is None:
        return "Unknown time"
    try:
        value = float(timestamp) / 1000.0
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return str(timestamp)


def _build_alert_text(log_data: dict[str, Any]) -> str:
    server_name = log_data.get("server_name") or "Unknown server"
    level = str(log_data.get("level") or "info").upper()
    score = float(log_data.get("anomaly_score") or 0.0)
    score_pct = round(score * 100)
    message = log_data.get("message") or "No message provided."
    timestamp = _format_timestamp(log_data.get("timestamp"))
    return (
        f"LogAI detected an anomaly on {server_name}\n"
        f"Level: {level}\n"
        f"Anomaly score: {score_pct}%\n"
        f"Time: {timestamp}\n"
        f"Message: {message}"
    )


def _build_webhook_payload(log_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": "anomaly_detected",
        "app": "LogAI",
        "server_id": log_data.get("server_id"),
        "server_name": log_data.get("server_name"),
        "level": log_data.get("level"),
        "message": log_data.get("message"),
        "anomaly": bool(log_data.get("anomaly", True)),
        "anomaly_score": log_data.get("anomaly_score"),
        "timestamp": log_data.get("timestamp"),
        "meta": log_data.get("meta") or {},
    }


async def _post_json(url: str, payload: dict[str, Any]) -> None:
    timeout = settings.NOTIFICATION_REQUEST_TIMEOUT_SECONDS
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()


async def _send_slack_notification(integration: AlertIntegration, log_data: dict[str, Any]) -> None:
    if not integration.slack_webhook_url:
        raise ValueError("Slack notifications are not configured.")

    text = _build_alert_text(log_data)
    payload = {
        "text": text,
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "LogAI anomaly detected"},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": text},
            },
        ],
    }
    await _post_json(integration.slack_webhook_url, payload)


def _send_email_sync(recipients: list[str], subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    context = ssl.create_default_context()
    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=10) as smtp:
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        smtp.ehlo()
        if settings.SMTP_USE_TLS:
            smtp.starttls(context=context)
            smtp.ehlo()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


async def _send_email_notification(
    integration: AlertIntegration,
    user: User,
    log_data: dict[str, Any],
) -> None:
    if not email_service_ready():
        raise ValueError("Email delivery is unavailable until SMTP settings are configured.")

    recipients = resolve_email_recipients(integration, user.email)
    if not recipients:
        raise ValueError("Email notifications require at least one recipient.")

    server_name = log_data.get("server_name") or "Unknown server"
    score_pct = round(float(log_data.get("anomaly_score") or 0.0) * 100)
    subject = f"{settings.ALERTS_EMAIL_SUBJECT_PREFIX} {server_name} anomaly ({score_pct}%)"
    body = _build_alert_text(log_data)
    await asyncio.to_thread(_send_email_sync, recipients, subject, body)


async def _send_webhook_notification(integration: AlertIntegration, log_data: dict[str, Any]) -> None:
    if not integration.webhook_url:
        raise ValueError("Webhook notifications are not configured.")
    await _post_json(integration.webhook_url, _build_webhook_payload(log_data))


async def send_test_notification(
    integration: AlertIntegration,
    user: User,
    channel: str,
    *,
    server_name: str,
    message: str,
    anomaly_score: float,
) -> None:
    """Send a synthetic alert through one selected channel."""
    sample = {
        "server_name": server_name,
        "server_id": "demo-server",
        "level": "critical",
        "message": message,
        "anomaly": True,
        "anomaly_score": anomaly_score,
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
        "meta": {"source": "manual-test"},
    }

    if channel == "slack":
        await _send_slack_notification(integration, sample)
        return
    if channel == "email":
        await _send_email_notification(integration, user, sample)
        return
    if channel == "webhook":
        await _send_webhook_notification(integration, sample)
        return
    raise ValueError("Unsupported test channel.")


async def dispatch_anomaly_notifications(server_id: str, log_data: dict[str, Any]) -> int:
    """Send notifications for anomaly documents or critical errors based on owner settings."""
    level = str(log_data.get("level") or "info").lower()
    is_critical_error = level in ("critical", "fatal")
    is_ml_anomaly = bool(log_data.get("anomaly"))

    if not (is_critical_error or is_ml_anomaly):
        return 0

    try:
        server_uuid = uuid.UUID(str(server_id))
    except ValueError:
        logger.warning("Skipping notifications for invalid server id: %s", server_id)
        return 0

    async with async_session_factory() as session:
        result = await session.execute(
            select(Server, User, AlertIntegration)
            .join(User, Server.owner_id == User.id)
            .outerjoin(AlertIntegration, AlertIntegration.owner_id == User.id)
            .where(Server.id == server_uuid)
        )
        row = result.first()

    if row is None:
        return 0

    server, user, integration = row
    if integration is None:
        return 0

    score = float(log_data.get("anomaly_score") or 0.0)
    # Bypass minimum score filter for critical errors
    if not is_critical_error and score < float(integration.minimum_anomaly_score):
        return 0

    payload = dict(log_data)
    payload["server_name"] = payload.get("server_name") or server.name
    payload["server_id"] = payload.get("server_id") or str(server.id)

    delivered = 0

    if integration.slack_enabled and integration.slack_webhook_url:
        try:
            await _send_slack_notification(integration, payload)
            delivered += 1
        except Exception as exc:
            logger.warning("Slack notification failed for user %s: %s", user.id, exc)

    if integration.email_enabled and resolve_email_recipients(integration, user.email):
        try:
            await _send_email_notification(integration, user, payload)
            delivered += 1
        except Exception as exc:
            logger.warning("Email notification failed for user %s: %s", user.id, exc)

    if integration.webhook_enabled and integration.webhook_url:
        try:
            await _send_webhook_notification(integration, payload)
            delivered += 1
        except Exception as exc:
            logger.warning("Webhook notification failed for user %s: %s", user.id, exc)

    return delivered
