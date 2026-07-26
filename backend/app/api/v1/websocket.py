"""
WebSocket route — /ws

Streams real-time logs from Redis pub/sub to connected browser clients.
Authenticates via JWT token passed as query parameter.

Client connects: ws://host/ws?token=<JWT>&server_id=<UUID>
Server sends:  {type: "connected"}, {type: "log", data: {...}}, {type: "anomaly", data: {...}}
Client sends:  {type: "subscribe", server_id: "..."}  — to switch server
"""

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from typing import Optional

from app.core.security import decode_token
from app.db.postgres import async_session_factory
from app.db.redis_client import create_pubsub
from app.models.server import Server

logger = logging.getLogger(__name__)
router = APIRouter()


def _channels_for_server_ids(server_ids: list[str]) -> list[str]:
    """Return log + anomaly channels for owned server ids."""
    channels: list[str] = []
    for sid in server_ids:
        channels.extend([
            f"logai:logs:{sid}",
            f"logai:anomalies:{sid}",
        ])
    return channels


async def _resolve_owned_server_ids(user_id: str, server_id: Optional[str]) -> list[str] | None:
    """Return accessible server ids for a subscription, or None when access is denied."""
    try:
        user_uuid = uuid.UUID(str(user_id))
        requested_server_uuid = uuid.UUID(str(server_id)) if server_id else None
    except ValueError:
        return None

    async with async_session_factory() as session:
        # Get all servers the user owns
        owned_result = await session.execute(
            select(Server.id)
            .where(Server.owner_id == user_uuid, Server.is_active == True)
        )
        accessible_ids = {str(sid) for sid in owned_result.scalars().all()}

        # Get all servers shared with the user
        try:
            from app.models.server_member import ServerMember
            shared_result = await session.execute(
                select(ServerMember.server_id)
                .join(Server, Server.id == ServerMember.server_id)
                .where(ServerMember.user_id == user_uuid, Server.is_active == True)
            )
            for sid in shared_result.scalars().all():
                accessible_ids.add(str(sid))
        except Exception as e:
            logger.error(f"Error fetching shared servers: {e}")

    if requested_server_uuid:
        req_str = str(requested_server_uuid)
        if req_str not in accessible_ids:
            return None
        return [req_str]

    return list(accessible_ids)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    server_id: Optional[str] = Query(None),
):
    """
    Real-time log streaming via WebSocket.

    1. Authenticate JWT from query param
    2. Subscribe to Redis pub/sub for the requested server
    3. Forward all published logs to the WebSocket client
    4. Handle subscribe messages to switch server
    5. Clean up on disconnect
    """
    # ── Authenticate ─────────────────────────────────────────
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    initial_server_ids = await _resolve_owned_server_ids(user_id, server_id)
    if initial_server_ids is None:
        await websocket.close(code=4003, reason="Access denied to this server")
        return

    await websocket.accept()

    # Send connected confirmation
    await websocket.send_json({"type": "connected", "user_id": user_id})

    # ── Set up Redis pub/sub ─────────────────────────────────
    pubsub = create_pubsub()
    current_server_id = server_id
    current_channels: list[str] = []

    async def subscribe_to_server_ids(sid: Optional[str], owned_server_ids: list[str]):
        """Subscribe to log + anomaly channels for the user's owned server ids."""
        nonlocal current_channels
        channels = _channels_for_server_ids(owned_server_ids)
        if channels:
            await pubsub.subscribe(*channels)
        current_channels = channels
        logger.info(
            "WebSocket subscribed to %s (%s channels)",
            f"server {sid}" if sid else "all owned servers",
            len(channels),
        )

    async def unsubscribe_current():
        """Unsubscribe from current server channels."""
        nonlocal current_channels
        if not current_channels:
            return
        try:
            await pubsub.unsubscribe(*current_channels)
            current_channels = []
        except Exception:
            pass

    # Subscribe immediately so both a specific server and "all servers" work in real-time.
    await subscribe_to_server_ids(current_server_id, initial_server_ids)

    # ── Message forwarding tasks ─────────────────────────────
    async def redis_listener():
        """Listen to Redis pub/sub and forward to WebSocket."""
        try:
            while True:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if message and message["type"] == "message":
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    try:
                        data = json.loads(message["data"])
                    except (json.JSONDecodeError, TypeError):
                        continue

                    if "anomalies" in channel:
                        await websocket.send_json({"type": "anomaly", "data": data})
                    else:
                        await websocket.send_json({"type": "log", "data": data})
                else:
                    await asyncio.sleep(0.1)
        except (WebSocketDisconnect, Exception):
            pass

    async def client_listener():
        """Listen for client messages (e.g., subscribe to different server)."""
        nonlocal current_server_id
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                if msg.get("type") == "subscribe":
                    requested_server_id = msg.get("server_id") or None
                    requested_server_ids = await _resolve_owned_server_ids(user_id, requested_server_id)
                    if requested_server_ids is None:
                        await websocket.send_json({
                            "type": "error",
                            "code": "access_denied",
                            "message": "Access denied to this server",
                        })
                        continue

                    await unsubscribe_current()
                    current_server_id = requested_server_id
                    await subscribe_to_server_ids(current_server_id, requested_server_ids)
                    await websocket.send_json({
                        "type": "subscribed",
                        "server_id": current_server_id,
                    })
        except (WebSocketDisconnect, Exception):
            pass

    # ── Run both listeners concurrently ──────────────────────
    try:
        await asyncio.gather(
            redis_listener(),
            client_listener(),
        )
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user={user_id}")
    finally:
        # Clean up: unsubscribe and close pub/sub
        try:
            await unsubscribe_current()
            await pubsub.close()
        except Exception:
            pass
