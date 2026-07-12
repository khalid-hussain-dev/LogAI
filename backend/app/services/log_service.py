"""
Log service — Elasticsearch-powered log ingestion, search, metrics, and chat context.

All ES queries and aggregations are built here. Routes never touch ES directly.
Metrics use ES aggregations (date_histogram, terms, filters) — never Python loops.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from elasticsearch import AsyncElasticsearch

from app.core.config import settings
from app.db.redis_client import publish_anomaly, publish_log
from app.services.anomaly_service import AnomalyService
from app.services.notification_service import dispatch_anomaly_notifications

logger = logging.getLogger(__name__)
anomaly_svc = AnomalyService()

INDEX = settings.ELASTICSEARCH_INDEX_LOGS


async def _publish_live_update(server_id: str, doc: Dict[str, Any]) -> None:
    """Publish a processed log to live dashboard WebSocket channels."""
    try:
        await publish_log(server_id, doc)
        if doc.get("anomaly"):
            await publish_anomaly(server_id, doc)
    except Exception as e:
        logger.warning(f"Failed to publish live log update: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# INGESTION
# ═══════════════════════════════════════════════════════════════════════════

async def ingest_single(
    es: AsyncElasticsearch,
    server_id: str,
    server_name: str,
    log: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Ingest a single log via API (not stream).
    Scores anomaly, indexes to ES, and publishes a live dashboard update.

    Returns: {id, anomaly, anomaly_score}
    """
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    timestamp = log.get("timestamp") or int(now.timestamp() * 1000)

    level = (log.get("level") or "info").lower()
    message = log.get("message", "")

    # Anomaly scoring
    score = anomaly_svc.score(
        server_id=server_id,
        level=level,
        message=message,
        meta=log.get("meta") or {},
    )
    is_anomaly = score >= settings.ANOMALY_SCORE_THRESHOLD

    doc = {
        "id": doc_id,
        "server_id": server_id,
        "server_name": server_name,
        "level": level,
        "message": message,
        "source": log.get("source"),
        "host": log.get("host"),
        "service": log.get("service"),
        "environment": log.get("environment"),
        "meta": log.get("meta") or {},
        "raw": message,
        "anomaly": is_anomaly,
        "anomaly_score": round(score, 4),
        "timestamp": timestamp,
        "ingested_at": now.isoformat(),
        "processed_by": "api-direct",
    }

    await es.index(index=INDEX, id=doc_id, document=doc)

    await _publish_live_update(server_id, doc)

    if is_anomaly:
        try:
            await dispatch_anomaly_notifications(server_id, doc)
        except Exception as e:
            logger.warning(f"Failed to send anomaly notifications: {e}")

    return {"id": doc_id, "anomaly": is_anomaly, "anomaly_score": round(score, 4)}


async def ingest_batch(
    es: AsyncElasticsearch,
    server_id: str,
    server_name: str,
    logs: List[Dict[str, Any]],
) -> Dict[str, int]:
    """
    Bulk ingest logs. Scores anomaly on each, bulk indexes to ES.

    Returns: {count, anomalies}
    """
    now = datetime.now(timezone.utc)
    operations = []
    anomaly_count = 0
    anomaly_docs = []
    indexed_docs = []

    for log in logs:
        doc_id = str(uuid.uuid4())
        timestamp = log.get("timestamp") or int(now.timestamp() * 1000)
        level = (log.get("level") or "info").lower()
        message = log.get("message", "")

        score = anomaly_svc.score(
            server_id=server_id,
            level=level,
            message=message,
            meta=log.get("meta") or {},
        )
        is_anomaly = score >= settings.ANOMALY_SCORE_THRESHOLD
        if is_anomaly:
            anomaly_count += 1

        doc = {
            "id": doc_id,
            "server_id": server_id,
            "server_name": server_name,
            "level": level,
            "message": message,
            "source": log.get("source"),
            "host": log.get("host"),
            "service": log.get("service"),
            "environment": log.get("environment"),
            "meta": log.get("meta") or {},
            "raw": message,
            "anomaly": is_anomaly,
            "anomaly_score": round(score, 4),
            "timestamp": timestamp,
            "ingested_at": now.isoformat(),
            "processed_by": "api-batch",
        }

        operations.append({"index": {"_index": INDEX, "_id": doc_id}})
        operations.append(doc)
        indexed_docs.append(doc)
        if is_anomaly:
            anomaly_docs.append(doc)

    if operations:
        await es.bulk(operations=operations, refresh="wait_for")

    for doc in indexed_docs:
        await _publish_live_update(server_id, doc)

    for doc in anomaly_docs:
        try:
            await dispatch_anomaly_notifications(server_id, doc)
        except Exception as e:
            logger.warning(f"Failed to send anomaly notifications: {e}")

    return {"count": len(logs), "anomalies": anomaly_count}


# ═══════════════════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════════════════

async def get_logs(
    es: AsyncElasticsearch,
    server_ids: List[str],
    level: Optional[str] = None,
    search: Optional[str] = None,
    anomaly_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Search logs with filtering, full-text search, and pagination.
    Uses ES query DSL — never Python loops for filtering.
    """
    if not server_ids:
        return {"total": 0, "logs": [], "limit": limit, "offset": offset}

    must = []
    filter_clauses = []

    # Filter by server(s)
    if server_ids:
        filter_clauses.append({"terms": {"server_id": server_ids}})

    # Filter by level
    if level:
        filter_clauses.append({"term": {"level": level.lower()}})

    # Filter anomaly only
    if anomaly_only:
        filter_clauses.append({"term": {"anomaly": True}})

    # Timestamp range
    if from_ts or to_ts:
        range_q: Dict[str, Any] = {}
        if from_ts:
            range_q["gte"] = from_ts
        if to_ts:
            range_q["lte"] = to_ts
        filter_clauses.append({"range": {"timestamp": range_q}})

    # Full-text search on message
    if search:
        must.append({"match": {"message": {"query": search, "fuzziness": "AUTO"}}})

    query: Dict[str, Any] = {
        "bool": {
            "must": must if must else [{"match_all": {}}],
            "filter": filter_clauses,
        }
    }

    resp = await es.search(
        index=INDEX,
        query=query,
        sort=[{"timestamp": {"order": "desc"}}],
        from_=offset,
        size=limit,
        track_total_hits=True,
    )

    total = resp["hits"]["total"]["value"]
    logs = [hit["_source"] for hit in resp["hits"]["hits"]]

    return {"total": total, "logs": logs, "limit": limit, "offset": offset}


# ═══════════════════════════════════════════════════════════════════════════
# METRICS & DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

async def get_server_stats_24h(
    es: AsyncElasticsearch,
    server_id: str,
) -> Dict[str, int]:
    """Get 24h stats for a single server using ES aggregations."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    resp = await es.search(
        index=INDEX,
        size=0,
        query={
            "bool": {
                "filter": [
                    {"term": {"server_id": server_id}},
                    {"range": {"timestamp": {"gte": int(day_ago.timestamp() * 1000)}}},
                ]
            }
        },
        aggs={
            "severity": {"terms": {"field": "level", "size": 10}},
            "anomalies": {"filter": {"term": {"anomaly": True}}},
        },
    )

    total = resp["hits"]["total"]["value"]
    error_count = 0
    for bucket in resp["aggregations"]["severity"]["buckets"]:
        if bucket["key"] in ("error", "critical"):
            error_count += bucket["doc_count"]
    anomaly_count = resp["aggregations"]["anomalies"]["doc_count"]

    return {
        "log_count_24h": total,
        "error_count_24h": error_count,
        "anomaly_count_24h": anomaly_count,
    }


async def get_metrics(
    es: AsyncElasticsearch,
    server_id: str,
) -> Dict[str, Any]:
    """
    Get server metrics: hourly chart, severity breakdown, anomaly stats.
    All computed via ES aggregations.
    """
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    resp = await es.search(
        index=INDEX,
        size=0,
        query={
            "bool": {
                "filter": [
                    {"term": {"server_id": server_id}},
                    {"range": {"timestamp": {"gte": int(day_ago.timestamp() * 1000)}}},
                ]
            }
        },
        aggs={
            "hourly": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": "1h",
                },
                "aggs": {
                    "errors": {
                        "filter": {"terms": {"level": ["error", "critical"]}}
                    },
                    "anomalies": {
                        "filter": {"term": {"anomaly": True}}
                    },
                },
            },
            "severity": {"terms": {"field": "level", "size": 10}},
            "anomaly_count": {"filter": {"term": {"anomaly": True}}},
            "avg_anomaly_score": {"avg": {"field": "anomaly_score"}},
        },
    )

    # Build hourly buckets
    hourly = []
    for bucket in resp["aggregations"]["hourly"]["buckets"]:
        hourly.append({
            "hour": bucket["key_as_string"],
            "count": bucket["doc_count"],
            "errors": bucket["errors"]["doc_count"],
            "anomalies": bucket["anomalies"]["doc_count"],
        })

    # Build severity map
    severity = {}
    for bucket in resp["aggregations"]["severity"]["buckets"]:
        severity[bucket["key"]] = bucket["doc_count"]

    total = resp["hits"]["total"]["value"]
    total_anomalies = resp["aggregations"]["anomaly_count"]["doc_count"]
    avg_score = resp["aggregations"]["avg_anomaly_score"]["value"] or 0.0

    return {
        "server_id": server_id,
        "hourly": hourly,
        "severity": severity,
        "total_logs": total,
        "total_anomalies": total_anomalies,
        "avg_anomaly_score": round(avg_score, 4),
    }


async def get_dashboard_overview(
    es: AsyncElasticsearch,
    server_ids: List[str],
) -> Dict[str, Any]:
    """
    Aggregated dashboard overview across all user's servers.
    Uses ES multi-aggregations for efficiency.
    """
    if not server_ids:
        return {
            "total_logs_24h": 0,
            "total_errors_24h": 0,
            "total_anomalies_24h": 0,
            "total_servers": 0,
            "severity_breakdown": {},
            "error_trends": [],
            "hourly_activity": [],
            "servers": [],
            "avg_response_time_ms": 0.0,
        }

    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)

    resp = await es.search(
        index=INDEX,
        size=0,
        query={
            "bool": {
                "filter": [
                    {"terms": {"server_id": server_ids}},
                    {"range": {"timestamp": {"gte": int(day_ago.timestamp() * 1000)}}},
                ]
            }
        },
        aggs={
            "severity": {"terms": {"field": "level", "size": 10}},
            "anomalies": {"filter": {"term": {"anomaly": True}}},
            "hourly": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": "1h",
                },
                "aggs": {
                    "errors": {
                        "filter": {"terms": {"level": ["error", "critical"]}}
                    },
                    "anomalies": {
                        "filter": {"term": {"anomaly": True}}
                    },
                },
            },
            "per_server": {
                "terms": {"field": "server_id", "size": 100},
                "aggs": {
                    "errors": {
                        "filter": {"terms": {"level": ["error", "critical"]}}
                    },
                    "anomalies": {
                        "filter": {"term": {"anomaly": True}}
                    },
                },
            },
        },
    )

    total_24h = resp["hits"]["total"]["value"]
    total_anomalies_24h = resp["aggregations"]["anomalies"]["doc_count"]

    severity = {}
    total_errors = 0
    for bucket in resp["aggregations"]["severity"]["buckets"]:
        severity[bucket["key"]] = bucket["doc_count"]
        if bucket["key"] in ("error", "critical"):
            total_errors += bucket["doc_count"]

    hourly_activity = []
    for bucket in resp["aggregations"]["hourly"]["buckets"]:
        hourly_activity.append({
            "hour": bucket["key_as_string"],
            "count": bucket["doc_count"],
            "errors": bucket["errors"]["doc_count"],
            "anomalies": bucket["anomalies"]["doc_count"],
        })

    # Per-server stats
    servers = []
    for bucket in resp["aggregations"]["per_server"]["buckets"]:
        sid = bucket["key"]
        count = bucket["doc_count"]
        errors = bucket["errors"]["doc_count"]
        anomalies = bucket["anomalies"]["doc_count"]
        health = max(0, 100 - (errors / max(count, 1)) * 100) if count > 0 else 100
        servers.append({
            "id": sid,
            "name": sid,  # Will be enriched by route
            "log_count_24h": count,
            "error_count_24h": errors,
            "anomaly_count_24h": anomalies,
            "health_pct": round(health, 1),
        })

    # Error trends (last 7 days, daily)
    trend_resp = await es.search(
        index=INDEX,
        size=0,
        query={
            "bool": {
                "filter": [
                    {"terms": {"server_id": server_ids}},
                    {"range": {"timestamp": {"gte": int(week_ago.timestamp() * 1000)}}},
                    {"terms": {"level": ["error", "critical"]}},
                ]
            }
        },
        aggs={
            "daily_errors": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": "1d",
                }
            }
        },
    )

    error_trends = []
    for bucket in trend_resp["aggregations"]["daily_errors"]["buckets"]:
        error_trends.append({
            "date": bucket["key_as_string"],
            "count": bucket["doc_count"],
        })

    return {
        "total_logs_24h": total_24h,
        "total_errors_24h": total_errors,
        "total_anomalies_24h": total_anomalies_24h,
        "total_servers": len(server_ids),
        "severity_breakdown": severity,
        "error_trends": error_trends,
        "hourly_activity": hourly_activity,
        "servers": servers,
        "avg_response_time_ms": 0.0,
    }


# ═══════════════════════════════════════════════════════════════════════════
# CHAT CONTEXT
# ═══════════════════════════════════════════════════════════════════════════

async def get_chat_context(
    es: AsyncElasticsearch,
    server_ids: List[str],
    user_message: str,
) -> str:
    """
    Build context from real ES data for the AI chat response.
    Searches recent logs matching the user's query and builds a summary.
    """
    if not server_ids:
        return "No log data available. Add a server and ingest some logs first."

    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)

    # Search for relevant logs
    resp = await es.search(
        index=INDEX,
        size=20,
        query={
            "bool": {
                "must": [{"match": {"message": {"query": user_message, "fuzziness": "AUTO"}}}],
                "filter": [
                    {"terms": {"server_id": server_ids}},
                ],
            }
        },
        sort=[{"timestamp": {"order": "desc"}}],
    )

    # Get recent stats
    stats_resp = await es.search(
        index=INDEX,
        size=0,
        query={
            "bool": {
                "filter": [
                    {"terms": {"server_id": server_ids}},
                    {"range": {"timestamp": {"gte": int(hour_ago.timestamp() * 1000)}}},
                ]
            }
        },
        aggs={
            "severity": {"terms": {"field": "level", "size": 10}},
            "anomalies": {"filter": {"term": {"anomaly": True}}},
        },
    )

    # Build context string
    context_parts = ["Based on your log data:\n"]

    # Recent stats
    total_recent = stats_resp["hits"]["total"]["value"]
    context_parts.append(f"- Total logs in last hour: {total_recent}")
    for bucket in stats_resp["aggregations"]["severity"]["buckets"]:
        context_parts.append(f"- {bucket['key'].upper()}: {bucket['doc_count']}")
    anomaly_ct = stats_resp["aggregations"]["anomalies"]["doc_count"]
    context_parts.append(f"- Anomalies detected: {anomaly_ct}")

    # Matching log samples
    hits = resp["hits"]["hits"]
    if hits:
        context_parts.append(f"\nRelevant log entries ({len(hits)} found):")
        for hit in hits[:10]:
            src = hit["_source"]
            context_parts.append(
                f"  [{src.get('level', 'info').upper()}] {src.get('message', '')[:200]}"
            )

    return "\n".join(context_parts)


async def generate_chat_response(
    es: AsyncElasticsearch,
    server_ids: List[str],
    message: str,
) -> str:
    """
    Generate a chat response by analysing real log data.
    Uses ES data to provide informed answers about the user's logs.
    """
    if not server_ids:
        return (
            "You don't have any active servers yet. "
            "Go to the **Servers** page, create a server, copy its API key, "
            "and start ingesting logs to use the AI chat assistant."
        )

    context = await get_chat_context(es, server_ids, message)

    # Simple keyword-based response engine backed by real data
    msg = message.lower()

    if any(kw in msg for kw in ["error", "problem", "issue", "fail", "bug"]):
        return (
            f"{context}\n\n"
            "I found the above error-related entries in your logs. "
            "Would you like me to analyze the root cause, check for patterns, "
            "or suggest fixes for specific errors?"
        )
    elif any(kw in msg for kw in ["anomal", "unusual", "spike", "abnormal"]):
        return (
            f"{context}\n\n"
            "The anomaly detection system has flagged the entries above. "
            "These may indicate unusual patterns in your infrastructure. "
            "Would you like details on specific anomalies?"
        )
    elif any(kw in msg for kw in ["status", "health", "overview", "summary"]):
        return (
            f"{context}\n\n"
            "This is your current system overview. "
            "Let me know if you want to drill into a specific server or time range."
        )
    elif any(kw in msg for kw in ["hello", "hi", "hey"]):
        return (
            "Hello! I'm your LogAI assistant. I can help you:\n"
            "- Analyze errors and anomalies\n"
            "- Check server health and status\n"
            "- Search through your log data\n"
            "- Identify patterns and trends\n\n"
            "What would you like to know?"
        )
    else:
        return (
            f"{context}\n\n"
            "I've searched your logs for relevant information. "
            "Could you provide more details about what you'd like to know? "
            "I can analyze errors, check anomalies, or provide system health summaries."
        )
