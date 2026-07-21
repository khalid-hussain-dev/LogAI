"""
Server routes — /api/v1/servers/*

CRUD operations, server sharing, key linking, metrics, and dashboard overview.
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
    ServerLinkRequest,
    ServerMemberResponse,
    ServerResponse,
    ServerShareRequest,
)
from app.services import log_service, server_service

router = APIRouter()


@router.get("", response_model=list[ServerResponse])
async def list_servers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """List all accessible servers (owned + shared) with 24h stats."""
    server_items = await server_service.list_servers(db, user.id)
    result = []

    for item in server_items:
        srv = item["server"]
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
            is_shared=item["is_shared"],
            role=item["role"],
            owner_email=item["owner_email"],
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
        is_shared=False,
        role="owner",
        owner_email=user.email,
    )


@router.post("/link-key", response_model=ServerResponse)
async def link_server_key(
    body: ServerLinkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """Link an existing server to current user using its API key."""
    try:
        item = await server_service.link_server_by_key(db, user.id, body.api_key)
        srv = item["server"]
        try:
            stats = await log_service.get_server_stats_24h(es, str(srv.id))
        except Exception:
            stats = {"log_count_24h": 0, "error_count_24h": 0, "anomaly_count_24h": 0}

        return ServerResponse(
            id=str(srv.id),
            name=srv.name,
            description=srv.description,
            api_key=srv.api_key,
            is_active=srv.is_active,
            created_at=srv.created_at.isoformat(),
            is_shared=item["is_shared"],
            role=item["role"],
            owner_email=item["owner_email"],
            **stats,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{server_id}/share", response_model=ServerMemberResponse)
async def share_server(
    server_id: uuid.UUID,
    body: ServerShareRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share access to a server with another user by email."""
    try:
        member = await server_service.share_server(
            db, server_id, user.id, body.email, body.role
        )
        return ServerMemberResponse(**member)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{server_id}/members", response_model=list[ServerMemberResponse])
async def list_members(
    server_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List members and owners of a server."""
    try:
        members = await server_service.list_server_members(db, server_id, user.id)
        return [ServerMemberResponse(**m) for m in members]
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.delete("/{server_id}/members/{target_user_id}")
async def remove_member(
    server_id: uuid.UUID,
    target_user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a shared member from a server."""
    try:
        removed = await server_service.remove_server_member(db, server_id, user.id, target_user_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"message": "Member removed"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
            detail="Server not found or access denied",
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
            detail="Server not found or access denied",
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
    srv = await server_service.get_server_by_id(db, server_id, user.id)
    if srv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found or access denied",
        )
    metrics = await log_service.get_metrics(es, str(server_id))
    return MetricsResponse(**metrics)


@router.get("/dashboard/overview", response_model=DashboardOverview)
async def dashboard_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    es: AsyncElasticsearch = Depends(get_es),
):
    """Get aggregated dashboard overview across all user's accessible servers."""
    server_items = await server_service.list_servers(db, user.id)
    server_ids = [str(item["server"].id) for item in server_items]

    overview = await log_service.get_dashboard_overview(es, server_ids)

    # Enrich server names
    name_map = {str(item["server"].id): item["server"].name for item in server_items}
    for srv in overview.get("servers", []):
        srv["name"] = name_map.get(srv["id"], srv["id"])

    return DashboardOverview(**overview)
