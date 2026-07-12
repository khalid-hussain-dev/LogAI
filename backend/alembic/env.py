"""
Alembic environment — async migrations for PostgreSQL.

Uses the DATABASE_URL from app settings (not alembic.ini).
"""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Ensure project root is on sys.path so `import app...` works when Alembic
# executes this file with sys.path[0] == "<project>/alembic".
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.db.postgres import Base

# Import all models so Alembic can discover them
import app.models  # noqa: F401

config = context.config
if config.config_file_name is not None:
    # `alembic.ini` in this repo is intentionally minimal (may not include
    # logging sections). Treat logging configuration as optional.
    try:
        fileConfig(config.config_file_name)
    except Exception:
        pass

target_metadata = Base.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode — generate SQL without connecting."""
    context.configure(
        url=settings.DATABASE_URL.replace("+asyncpg", ""),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Configure and run migrations with a connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    """Run migrations in 'online' mode — with an async engine."""
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

