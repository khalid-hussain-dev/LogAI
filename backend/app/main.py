"""
LogAI Backend — FastAPI application factory.

This is the main entry point. Sets up:
- CORS middleware
- Request logging middleware
- API router (v1)
- Lifespan hooks (startup: create ES index; shutdown: close clients)
- Health check endpoint
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.api.v1.websocket import router as websocket_router
from app.core.config import settings
from app.db.elasticsearch import close_es_client, ensure_log_index
from app.db.redis_client import close_redis_client
from app.middleware.logging import RequestLoggingMiddleware

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown hooks."""
    # ── Startup ──────────────────────────────────────────────
    logger.info("LogAI Backend starting up...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Version: {settings.APP_VERSION}")

    # Create Elasticsearch index with mappings
    try:
        await ensure_log_index()
        logger.info("Elasticsearch index ready")
    except Exception as e:
        logger.error(f"Failed to initialize Elasticsearch: {e}")

    yield

    # ── Shutdown ─────────────────────────────────────────────
    logger.info("LogAI Backend shutting down...")
    await close_es_client()
    await close_redis_client()


# ── Create app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="LogAI API",
    description="AI-powered log monitoring and analytics platform",
    version=settings.APP_VERSION,
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging ─────────────────────────────────────────────────────────
app.add_middleware(RequestLoggingMiddleware)

# ── Routes ──────────────────────────────────────────────────────────────────
app.include_router(api_router)
app.include_router(websocket_router)


@app.get("/")
async def root():
    """Root endpoint — welcome message and status index."""
    return {
        "name": "LogAI Backend API",
        "status": "online",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "api": "/api/v1",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "version": settings.APP_VERSION}

