"""
Log schemas — request and response models for log ingestion, search, servers, and dashboard.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Log Ingestion ───────────────────────────────────────────────────────────

class LogIngestRequest(BaseModel):
    """Single log entry for ingestion via API."""
    level: str = Field("info", description="Log level: debug, info, warn, error, critical")
    message: str = Field(..., min_length=1, max_length=10000)
    source: Optional[str] = None
    host: Optional[str] = None
    service: Optional[str] = None
    environment: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: Optional[int] = Field(None, description="Epoch milliseconds")


class BatchIngestRequest(BaseModel):
    """Batch log ingestion — up to 1000 entries."""
    logs: List[LogIngestRequest] = Field(..., max_length=1000)


class IngestResponse(BaseModel):
    """Response from single log ingestion."""
    id: str
    anomaly: bool
    anomaly_score: float


class BatchIngestResponse(BaseModel):
    """Response from batch log ingestion."""
    count: int
    anomalies: int


# ── Log Entry (ES document) ────────────────────────────────────────────────

class LogEntry(BaseModel):
    """A log entry as stored in Elasticsearch."""
    id: str
    server_id: str
    server_name: Optional[str] = None
    level: str
    message: str
    source: Optional[str] = None
    host: Optional[str] = None
    service: Optional[str] = None
    environment: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    raw: Optional[str] = None
    anomaly: bool = False
    anomaly_score: float = 0.0
    timestamp: int
    ingested_at: Optional[str] = None
    processed_by: Optional[str] = None


class LogListResponse(BaseModel):
    """Paginated list of log entries."""
    total: int
    logs: List[LogEntry]
    limit: int
    offset: int


# ── Server Responses ────────────────────────────────────────────────────────

class ServerResponse(BaseModel):
    """Server with 24h stats."""
    id: str
    name: str
    description: Optional[str] = None
    api_key: str
    is_active: bool
    created_at: str
    log_count_24h: int = 0
    error_count_24h: int = 0
    anomaly_count_24h: int = 0

    class Config:
        from_attributes = True


class ServerCreateRequest(BaseModel):
    """Body for POST /servers."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


# ── Metrics ─────────────────────────────────────────────────────────────────

class HourlyBucket(BaseModel):
    """One hour of log counts."""
    hour: str
    count: int
    errors: int
    anomalies: int


class MetricsResponse(BaseModel):
    """Server metrics — hourly chart, severity breakdown, anomalies."""
    server_id: str
    hourly: List[HourlyBucket]
    severity: Dict[str, int]
    total_logs: int
    total_anomalies: int
    avg_anomaly_score: float


# ── Dashboard Overview ──────────────────────────────────────────────────────

class ServerOverview(BaseModel):
    """Quick stats for one server on the dashboard."""
    id: str
    name: str
    log_count_24h: int
    error_count_24h: int
    anomaly_count_24h: int
    health_pct: float


class DashboardOverview(BaseModel):
    """Aggregated dashboard data across all user's servers."""
    total_logs_24h: int
    total_errors_24h: int
    total_anomalies_24h: int
    total_servers: int
    severity_breakdown: Dict[str, int]
    error_trends: List[Dict[str, Any]]
    hourly_activity: List[HourlyBucket] = Field(default_factory=list)
    servers: List[ServerOverview]
    avg_response_time_ms: float = 0.0


# ── Chat ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Body for POST /chat."""
    message: str = Field(..., min_length=1, max_length=2000)
    server_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response from AI analysis."""
    response: str
