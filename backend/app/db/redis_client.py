"""
Async Redis client serving THREE distinct roles:

1. Streams  — durable message queue (log ingestion pipeline)
2. Pub/Sub  — real-time WebSocket broadcast
3. Rate Limiting — sliding window counters

All functions are clearly separated by role.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Singleton client ────────────────────────────────────────────────────────
_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis:
    """Return the shared async Redis client (lazy init)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=50,
        )
    return _redis_client


async def close_redis_client():
    """Close the Redis client gracefully."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


# ═══════════════════════════════════════════════════════════════════════════
# ROLE 1: STREAMS — Durable message queue
# ═══════════════════════════════════════════════════════════════════════════

async def push_to_stream(stream_key: str, fields: Dict[str, str]) -> str:
    """Push a message to a Redis Stream. Returns the message ID."""
    r = get_redis_client()
    msg_id = await r.xadd(stream_key, fields)
    return msg_id


async def read_from_stream(
    stream_key: str,
    group: str,
    consumer: str,
    count: int = 50,
    block: int = 2000,
) -> List:
    """Read messages from a Redis Stream using a consumer group."""
    r = get_redis_client()
    try:
        messages = await r.xreadgroup(
            groupname=group,
            consumername=consumer,
            streams={stream_key: ">"},
            count=count,
            block=block,
        )
        return messages
    except Exception as e:
        logger.error(f"Error reading from stream {stream_key}: {e}")
        return []


async def ack_stream_message(stream_key: str, group: str, msg_id: str):
    """Acknowledge a processed stream message."""
    r = get_redis_client()
    await r.xack(stream_key, group, msg_id)


async def ensure_consumer_group(stream_key: str, group: str):
    """Create a consumer group if it doesn't exist."""
    r = get_redis_client()
    try:
        await r.xgroup_create(stream_key, group, id="0", mkstream=True)
        logger.info(f"Created consumer group '{group}' on stream '{stream_key}'")
    except aioredis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            logger.info(f"Consumer group '{group}' already exists on '{stream_key}'")
        else:
            raise


# ═══════════════════════════════════════════════════════════════════════════
# ROLE 2: PUB/SUB — Real-time WebSocket broadcast
# ═══════════════════════════════════════════════════════════════════════════

async def publish_log(server_id: str, log_data: Dict[str, Any]):
    """Publish a log entry to server-specific and global channels for WebSocket delivery."""
    r = get_redis_client()
    data = json.dumps(log_data, default=str)
    await r.publish(f"logai:logs:{server_id}", data)
    await r.publish("logai:logs:global", data)


async def publish_anomaly(server_id: str, log_data: Dict[str, Any]):
    """Publish an anomaly to both the server channel and the global anomaly channel."""
    r = get_redis_client()
    data = json.dumps(log_data, default=str)
    # Server-specific anomaly channel
    await r.publish(f"logai:anomalies:{server_id}", data)
    # Global anomaly channel (for dashboard overview)
    await r.publish("logai:anomalies:global", data)


def create_pubsub() -> aioredis.client.PubSub:
    """Create a new PubSub instance for subscribing to channels."""
    r = get_redis_client()
    return r.pubsub()


# ═══════════════════════════════════════════════════════════════════════════
# ROLE 3: RATE LIMITING — Sliding window
# ═══════════════════════════════════════════════════════════════════════════

async def check_rate_limit(key: str, limit: int, window_seconds: int = 60) -> bool:
    """
    Sliding window rate limiter.

    Returns True if the request is ALLOWED, False if rate limit exceeded.
    Uses a sorted set with timestamps as scores.
    """
    r = get_redis_client()
    now = time.time()
    window_start = now - window_seconds

    pipe = r.pipeline()
    # Remove old entries outside the window
    pipe.zremrangebyscore(key, 0, window_start)
    # Count current entries in window
    pipe.zcard(key)
    # Add current request
    pipe.zadd(key, {f"{now}": now})
    # Set TTL so keys auto-expire
    pipe.expire(key, window_seconds + 1)
    results = await pipe.execute()

    current_count = results[1]
    return current_count < limit
