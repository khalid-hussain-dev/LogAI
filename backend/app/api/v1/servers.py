"""
Server routes — /api/v1/servers/*

CRUD operations + metrics + dashboard overview.
All protected by JWT auth.
"""

import uuid

from elasticsearch import AsyncElasticsearch
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, get_es
from app.models.user import User
from app.schemas.logs import (
    DashboardOverview,
    MetricsResponse,
    ServerCreateRequest,
    ServerResponse,
)
from app.services import log_service, server_service

router = APIRouter()


@router.get("", response_model=list[ServerResponse])
async def list_servers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """List all user's servers with 24h stats from Elasticsearch."""
    servers = await server_service.list_servers(db, user.id)
    result = []

    for srv in servers:
        try:
            stats = await log_service.get_server_stats_24h(es, str(srv.id))
        except Exception:
            stats = {"log_count_24h": 0, "error_count_24h": 0, "anomaly_count_24h": 0}

        result.append(ServerResponse(
            id=str(srv.id),
            name=srv.name,
            description=srv.description,
            api_key=srv.api_key,
            is_active=srv.is_active,
            created_at=srv.created_at.isoformat(),
            **stats,
        ))

    return result


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    body: ServerCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new server. Returns the server with its generated API key."""
    srv = await server_service.create_server(
        db, user.id, body.name, body.description
    )
    return ServerResponse(
        id=str(srv.id),
        name=srv.name,
        description=srv.description,
        api_key=srv.api_key,
        is_active=srv.is_active,
        created_at=srv.created_at.isoformat(),
    )


@router.delete("/{server_id}")
async def delete_server(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a server."""
    deleted = await server_service.delete_server(db, server_id, user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )
    return {"message": "Server deleted"}


@router.post("/{server_id}/rotate-key")
async def rotate_key(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate the API key for a server."""
    new_key = await server_service.rotate_api_key(db, server_id, user.id)
    if new_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )
    return {"api_key": new_key}


@router.get("/{server_id}/metrics", response_model=MetricsResponse)
async def get_metrics(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """Get detailed metrics for a server (hourly chart, severity, anomalies)."""
    # Verify ownership
    srv = await server_service.get_server_by_id(db, server_id, user.id)
    if srv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found",
        )
    metrics = await log_service.get_metrics(es, str(server_id))
    return MetricsResponse(**metrics)


@router.get("/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """Get aggregated dashboard overview across all user's servers."""
    servers = await server_service.list_servers(db, user.id)
    server_ids = [str(s.id) for s in servers]

    overview = await log_service.get_dashboard_overview(es, server_ids)

    # Enrich server names
    name_map = {str(s.id): s.name for s in servers}
    for srv in overview.get("servers", []):
        srv["name"] = name_map.get(srv["id"], srv["id"])

    return DashboardOverview(**overview)

