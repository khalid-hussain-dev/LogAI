"""
API v1 — registers all routers.
"""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.logs import router as logs_router
from app.api.v1.servers import router as servers_router
from app.api.v1.websocket import router as ws_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["Integrations"])
api_router.include_router(logs_router, tags=["Logs"])
api_router.include_router(servers_router, prefix="/servers", tags=["Servers"])
api_router.include_router(ws_router, tags=["WebSocket"])
