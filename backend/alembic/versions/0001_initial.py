"""Initial migration — creates users and servers tables.

Revision ID: 0001
Revises: -
Create Date: 2025-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ── Users table ──────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=True),
        sa.Column("picture", sa.String(1024), nullable=True),
        sa.Column("auth_provider", sa.String(20), nullable=False, server_default="local"),
        sa.Column("oauth_id", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── Servers table ────────────────────────────────────────
    op.create_table(
        "servers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("api_key", sa.String(255), nullable=False, unique=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_servers_api_key", "servers", ["api_key"])
    op.create_index("ix_servers_owner_id", "servers", ["owner_id"])


def downgrade():
    op.drop_table("servers")
    op.drop_table("users")

