"""
Server service — CRUD operations for monitored servers.

All operations are PostgreSQL-only. Log stats come from the log_service.
"""

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_key
from app.models.server import Server


async def list_servers(db: AsyncSession, owner_id: uuid.UUID) -> List[Server]:
    """List all active servers owned by a user."""
    result = await db.execute(
        select(Server)
        .where(Server.owner_id == owner_id, Server.is_active == True)
        .order_by(Server.created_at.desc())
    )
    return list(result.scalars().all())


async def create_server(
    db: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    description: Optional[str] = None,
) -> Server:
    """Create a new server with a generated API key."""
    server = Server(
        name=name,
        description=description,
        owner_id=owner_id,
    )
    db.add(server)
    await db.flush()
    return server


async def delete_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> bool:
    """Soft-delete a server (set is_active=False). Returns False if not found."""
    result = await db.execute(
        select(Server).where(
            Server.id == server_id,
            Server.owner_id == owner_id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        return False

    server.is_active = False
    await db.flush()
    return True


async def rotate_api_key(
    db: AsyncSession,
    server_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Optional[str]:
    """Generate a new API key for a server. Returns the new key or None."""
    result = await db.execute(
        select(Server).where(
            Server.id == server_id,
            Server.owner_id == owner_id,
        )
    )
    server = result.scalar_one_or_none()
    if server is None:
        return None

    server.api_key = generate_api_key()
    await db.flush()
    return server.api_key


async def get_server_by_id(
    db: AsyncSession,
    server_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> Optional[Server]:
    """Get a single server by ID, only if owned by the given user."""
    result = await db.execute(
        select(Server).where(
            Server.id == server_id,
            Server.owner_id == owner_id,
        )
    )
    return result.scalar_one_or_none()

