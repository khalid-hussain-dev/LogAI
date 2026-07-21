"""
Server service — CRUD operations, server sharing, and API key linking.

All operations are PostgreSQL-only. Log stats come from log_service.
"""

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_key
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User


async def list_servers(db: AsyncSession, user_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    List all active servers accessible to a user (both owned and shared).
    Returns a list of dict objects containing server entity, role, is_shared, and owner_email.
    Gracefully falls back to owned-only if server_members table doesn't exist yet.
    """
    # Query owned servers
    owned_result = await db.execute(
        select(Server, User.email)
        .join(User, Server.owner_id == User.id)
        .where(Server.owner_id == user_id, Server.is_active == True)
        .order_by(Server.created_at.desc())
    )
    owned_rows = owned_result.all()

    result = []
    seen_ids = set()

    for server, owner_email in owned_rows:
        seen_ids.add(server.id)
        result.append({
            "server": server,
            "role": "owner",
            "is_shared": False,
            "owner_email": owner_email,
        })

    # Query shared servers — gracefully skip if table hasn't been migrated yet
    try:
        shared_result = await db.execute(
            select(Server, ServerMember.role, User.email)
            .join(ServerMember, Server.id == ServerMember.server_id)
            .join(User, Server.owner_id == User.id)
            .where(ServerMember.user_id == user_id, Server.is_active == True)
            .order_by(Server.created_at.desc())
        )
        shared_rows = shared_result.all()
        for server, role, owner_email in shared_rows:
            if server.id not in seen_ids:
                seen_ids.add(server.id)
                result.append({
                    "server": server,
                    "role": role,
                    "is_shared": True,
                    "owner_email": owner_email,
                })
    except Exception:
        # server_members table may not exist if migration hasn't run yet
        pass

    return result


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


async def link_server_by_key(
    db: AsyncSession,
    user_id: uuid.UUID,
    api_key: str,
) -> Dict[str, Any]:
    """Link an existing server to user's account using its API key."""
    result = await db.execute(
        select(Server, User.email)
        .join(User, Server.owner_id == User.id)
        .where(Server.api_key == api_key.strip(), Server.is_active == True)
    )
    row = result.first()
    if not row:
        raise ValueError("Invalid server API key. Server not found.")

    server, owner_email = row

    if server.owner_id == user_id:
        return {"server": server, "role": "owner", "is_shared": False, "owner_email": owner_email}

    # Check if already a member
    member_res = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server.id,
            ServerMember.user_id == user_id,
        )
    )
    member = member_res.scalar_one_or_none()
    if member:
        return {"server": server, "role": member.role, "is_shared": True, "owner_email": owner_email}

    # Add as shared viewer
    new_member = ServerMember(
        server_id=server.id,
        user_id=user_id,
        role="viewer",
    )
    db.add(new_member)
    await db.flush()

    return {"server": server, "role": "viewer", "is_shared": True, "owner_email": owner_email}


async def share_server(
    db: AsyncSession,
    server_id: uuid.UUID,
    owner_id: uuid.UUID,
    target_email: str,
    role: str = "viewer",
) -> Dict[str, Any]:
    """Invite a user by email to share access to a server."""
    # Verify owner / admin access
    server_res = await db.execute(
        select(Server).where(Server.id == server_id, Server.is_active == True)
    )
    server = server_res.scalar_one_or_none()
    if not server:
        raise ValueError("Server not found.")

    if server.owner_id != owner_id:
        # Check if caller is admin member
        admin_check = await db.execute(
            select(ServerMember).where(
                ServerMember.server_id == server_id,
                ServerMember.user_id == owner_id,
                ServerMember.role == "admin",
            )
        )
        if not admin_check.scalar_one_or_none():
            raise ValueError("Only the server owner or admin can share this server.")

    # Find target user by email
    user_res = await db.execute(select(User).where(User.email == target_email.strip()))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise ValueError(f"No user found with email '{target_email}'.")

    if target_user.id == server.owner_id:
        raise ValueError("Cannot share server with its own owner.")

    # Upsert member
    existing_res = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_id,
            ServerMember.user_id == target_user.id,
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        existing.role = role
        await db.flush()
        return {
            "id": str(existing.id),
            "user_id": str(target_user.id),
            "name": target_user.name,
            "email": target_user.email,
            "picture": target_user.picture,
            "role": role,
            "is_owner": False,
            "created_at": existing.created_at.isoformat(),
        }

    new_member = ServerMember(
        server_id=server_id,
        user_id=target_user.id,
        role=role,
    )
    db.add(new_member)
    await db.flush()

    return {
        "id": str(new_member.id),
        "user_id": str(target_user.id),
        "name": target_user.name,
        "email": target_user.email,
        "picture": target_user.picture,
        "role": role,
        "is_owner": False,
        "created_at": new_member.created_at.isoformat(),
    }


async def list_server_members(
    db: AsyncSession,
    server_id: uuid.UUID,
    user_id: uuid.UUID,
) -> List[Dict[str, Any]]:
    """List all members (owner + invited users) of a server."""
    server_res = await db.execute(select(Server).where(Server.id == server_id))
    server = server_res.scalar_one_or_none()
    if not server:
        raise ValueError("Server not found.")

    # Verify access
    if server.owner_id != user_id:
        mem_check = await db.execute(
            select(ServerMember).where(
                ServerMember.server_id == server_id,
                ServerMember.user_id == user_id,
            )
        )
        if not mem_check.scalar_one_or_none():
            raise ValueError("Access denied to this server.")

    # Get owner info
    owner_res = await db.execute(select(User).where(User.id == server.owner_id))
    owner = owner_res.scalar_one()

    members = [{
        "id": f"owner-{owner.id}",
        "user_id": str(owner.id),
        "name": owner.name,
        "email": owner.email,
        "picture": owner.picture,
        "role": "owner",
        "is_owner": True,
        "created_at": server.created_at.isoformat(),
    }]

    # Get shared members
    shared_res = await db.execute(
        select(ServerMember, User)
        .join(User, ServerMember.user_id == User.id)
        .where(ServerMember.server_id == server_id)
        .order_by(ServerMember.created_at.asc())
    )

    for member, usr in shared_res.all():
        members.append({
            "id": str(member.id),
            "user_id": str(usr.id),
            "name": usr.name,
            "email": usr.email,
            "picture": usr.picture,
            "role": member.role,
            "is_owner": False,
            "created_at": member.created_at.isoformat(),
        })

    return members


async def remove_server_member(
    db: AsyncSession,
    server_id: uuid.UUID,
    owner_id: uuid.UUID,
    target_user_id: uuid.UUID,
) -> bool:
    """Remove a shared member from a server."""
    server_res = await db.execute(select(Server).where(Server.id == server_id))
    server = server_res.scalar_one_or_none()
    if not server or server.owner_id != owner_id:
        raise ValueError("Only the server owner can remove members.")

    result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_id,
            ServerMember.user_id == target_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        return False

    await db.delete(member)
    await db.flush()
    return True


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
    user_id: uuid.UUID,
) -> Optional[Server]:
    """Get a single server by ID, if owned or shared with user."""
    result = await db.execute(
        select(Server)
        .outerjoin(ServerMember, Server.id == ServerMember.server_id)
        .where(
            Server.id == server_id,
            Server.is_active == True,
            or_(Server.owner_id == user_id, ServerMember.user_id == user_id),
        )
    )
    return result.scalar_one_or_none()
