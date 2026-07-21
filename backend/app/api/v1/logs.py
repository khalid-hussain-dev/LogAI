"""
Log routes — /api/v1/ingest, /api/v1/logs, /api/v1/chat

Ingest endpoints use API key auth (x-api-key header).
Search and chat endpoints use JWT auth (Bearer token).
"""

from typing import Optional

from elasticsearch import AsyncElasticsearch
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, get_es, get_redis, get_server_by_api_key
from app.db.redis_client import check_rate_limit
from app.models.server import Server
from app.models.user import User
from app.schemas.logs import (
    BatchIngestRequest,
    BatchIngestResponse,
    ChatRequest,
    ChatResponse,
    IngestResponse,
    LogIngestRequest,
    LogListResponse,
)
from app.services import log_service

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# INGEST (API Key auth)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_single(
    body: LogIngestRequest,
    server: Server = Depends(get_server_by_api_key),
    es: AsyncElasticsearch = Depends(get_es),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Ingest a single log entry. Requires x-api-key header."""
    # Rate limiting
    allowed = await check_rate_limit(
        f"rate:ingest:{server.id}",
        settings.INGEST_RATE_LIMIT_PER_MINUTE,
        60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )

    result = await log_service.ingest_single(
        es,
        str(server.id),
        server.name,
        body.model_dump(),
    )
    return IngestResponse(**result)


@router.post("/ingest/batch", response_model=BatchIngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_batch(
    body: BatchIngestRequest,
    server: Server = Depends(get_server_by_api_key),
    es: AsyncElasticsearch = Depends(get_es),
    redis: aioredis.Redis = Depends(get_redis),
):
    """Batch ingest up to 1000 log entries. Requires x-api-key header."""
    # Rate limiting
    allowed = await check_rate_limit(
        f"rate:ingest:{server.id}",
        settings.INGEST_RATE_LIMIT_PER_MINUTE,
        60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )

    result = await log_service.ingest_batch(
        es,
        str(server.id),
        server.name,
        [log.model_dump() for log in body.logs],
    )
    return BatchIngestResponse(**result)


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH (JWT auth)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/logs", response_model=LogListResponse)
async def list_logs(
    server_id: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    anomaly_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    from_ts: Optional[int] = Query(None),
    to_ts: Optional[int] = Query(None),
    user: User = Depends(get_current_user),
    es: AsyncElasticsearch = Depends(get_es),
    db: AsyncSession = Depends(get_db),
):
    """Search logs with filtering, pagination, and full-text search."""
    # Explicitly query DB for this user's active server IDs — never rely on
    # the ORM relationship which can be stale or unloaded, causing all-user
    # log leakage when server_ids resolves to an empty list.
    from app.services import server_service
    user_servers = await server_service.list_servers(db, user.id)
    server_ids = [str(item["server"].id) for item in user_servers if item["server"].is_active]

    # If specific server requested, verify ownership/access
    if server_id:
        if server_id not in server_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this server",
            )
        server_ids = [server_id]

    result = await log_service.get_logs(
        es,
        server_ids=server_ids,
        level=level,
        search=search,
        anomaly_only=anomaly_only,
        limit=limit,
        offset=offset,
        from_ts=from_ts,
        to_ts=to_ts,
    )
    return LogListResponse(**result)


# ═══════════════════════════════════════════════════════════════════════════
# CHAT (JWT auth)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    es: AsyncElasticsearch = Depends(get_es),
    db: AsyncSession = Depends(get_db),
):
    """AI chat — queries real ES data to answer log-related questions."""
    from app.services import server_service
    user_servers = await server_service.list_servers(db, user.id)
    server_ids = [str(item["server"].id) for item in user_servers if item["server"].is_active]

    # If specific server requested, verify ownership
    if body.server_id:
        if body.server_id not in server_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this server",
            )
        server_ids = [body.server_id]

    response = await log_service.generate_chat_response(
        es, server_ids, body.message
    )
    return ChatResponse(response=response)

