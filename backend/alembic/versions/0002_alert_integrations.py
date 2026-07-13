"""Add alert integrations table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "alert_integrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("slack_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("slack_webhook_url", sa.String(length=1024), nullable=True),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email_recipients", sa.Text(), nullable=True),
        sa.Column("webhook_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("webhook_url", sa.String(length=1024), nullable=True),
        sa.Column("minimum_anomaly_score", sa.Float(), nullable=False, server_default=sa.text("0.7")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("owner_id", name="uq_alert_integrations_owner_id"),
    )
    op.create_index("ix_alert_integrations_owner_id", "alert_integrations", ["owner_id"])


def downgrade():
    op.drop_index("ix_alert_integrations_owner_id", table_name="alert_integrations")
    op.drop_table("alert_integrations")
