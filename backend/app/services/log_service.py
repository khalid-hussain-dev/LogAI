"""
Log service — Elasticsearch-powered log ingestion, search, metrics, and chat context.

All ES queries and aggregations are built here. Routes never touch ES directly.
Metrics use ES aggregations (date_histogram, terms, filters) — never Python loops.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import httpx

from elasticsearch import AsyncElasticsearch

from app.core.config import settings
from app.db.redis_client import publish_anomaly, publish_log
from app.services.anomaly_service import AnomalyService
from app.services.notification_service import dispatch_anomaly_notifications
from app.ai.fallback_model import fallback_ai
from app.ai.cortex_prime import cortex_prime_v1, cortex_prime_v2

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

    if is_anomaly or level in ("critical", "fatal"):
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
    notify_docs = []
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
        if is_anomaly or level in ("critical", "fatal"):
            notify_docs.append(doc)

    if operations:
        await es.bulk(operations=operations, refresh="wait_for")

    for doc in indexed_docs:
        await _publish_live_update(server_id, doc)

    for doc in notify_docs:
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
    model: str = "deepseek",
) -> str:
    """
    Generate a chat response by analysing real log data using DeepSeek AI.
    Uses ES data context to provide informed, intelligent answers & fixes.
    """
    if not server_ids:
        return (
            "You don't have any active servers yet. "
            "Go to the **Servers** page, create a server, copy its API key, "
            "and start ingesting logs to use the AI chat assistant."
        )

    # Route to Pulse immediately if selected
    if model == "pulse":
        try:
            overview = await get_dashboard_overview(es, server_ids)
            total_logs = overview.get("total_logs_24h", 0)
            total_errors = overview.get("total_errors_24h", 0)
            total_anomalies = overview.get("total_anomalies_24h", 0)
            active_nodes = len(server_ids)
            
            error_rate = round((total_errors / max(total_logs, 1)) * 100, 1)
            status = "DEGRADED" if total_errors > 0 or total_anomalies > 0 else "OPERATIONAL"
            status_color = "🔴" if status == "DEGRADED" else "🟢"
            
            breakdown_parts = []
            for k, v in overview.get("severity_breakdown", {}).items():
                breakdown_parts.append(f"  - **{k.upper()}:** {v}")
            breakdown_str = "\n".join(breakdown_parts) if breakdown_parts else "  - *No log packets ingested yet.*"

            response = (
                f"**📊 LogAI Pulse (Zero-Inference System Report)**\n\n"
                f"**Current Status:** {status_color} **{status}**\n\n"
                f"**Live Telemetry Metrics (Last 24h):**\n"
                f"- **Total Logs Ingested:** {total_logs}\n"
                f"- **System Error Rate:** {error_rate}%\n"
                f"- **AI Anomalies Flagged:** {total_anomalies}\n"
                f"- **Active Monitored Nodes:** {active_nodes}\n\n"
                f"**Severity Breakdown:**\n{breakdown_str}\n\n"
                f"--- \n*LogAI Pulse queries metrics directly from your Elasticsearch index. No machine learning inference was used.*"
            )
            return response
        except Exception as e:
            logger.error(f"LogAI Pulse metrics lookup failed: {e}")
            return "❌ **LogAI Pulse Error:** Failed to aggregate telemetry statistics from Elasticsearch."

    # Route to Cortex Prime V1 (Tier 3) if selected
    if model == "cortex-prime":
        fallback_res = cortex_prime_v1.predict(message)
        return fallback_res["response"]

    # Route to Cortex Prime V2 (Tier 3) if selected
    if model == "cortex-prime-v2":
        fallback_res = cortex_prime_v2.predict(message)
        return fallback_res["response"]

    # Route to Cortex (Tier 1) immediately if selected
    if model == "cortex":
        fallback_res = fallback_ai.predict(message, exclude_dynamic=True)
        return fallback_res["response"]

    # Route to Cortex Adaptive (Tier 2) immediately if selected
    if model in ("localbrain", "cortex-adaptive"):
        fallback_res = fallback_ai.predict(message, exclude_dynamic=False)
        return fallback_res["response"]

    context = await get_chat_context(es, server_ids, message)

    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        logger.warning("DEEPSEEK_API_KEY is not configured. Falling back to local ML model.")
        fallback_res = fallback_ai.predict(message)
        return fallback_res["response"]

    system_prompt = (
        "You are LogAI, an expert Site Reliability Engineer and AI Log Analysis Assistant. "
        "You analyze real-time Elasticsearch log data, detect system anomalies, identify error root causes, "
        "and provide actionable step-by-step resolution suggestions. "
        "Format your answer cleanly with markdown **bold** text and bullet points (- ). Keep it direct, helpful, and technical."
    )

    prompt = (
        f"### REAL-TIME ELASTICSEARCH LOG CONTEXT:\n{context}\n\n"
        f"### USER INQUIRY:\n{message}"
    )

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": getattr(settings, "DEEPSEEK_MODEL", "deepseek-chat"),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            ai_text = data["choices"][0]["message"]["content"]
            
            # --- Dynamic Caching Loop ---
            # If this is a critical log analysis request, cache it in the fallback model
            if message.startswith("Analyze this critical log from "):
                log_pattern = ""
                parts = message.split(":", 1)
                if len(parts) > 1:
                    log_pattern = parts[1].strip()
                else:
                    log_pattern = message.replace("Analyze this critical log from ", "").strip()
                
                if log_pattern:
                    fallback_ai.add_pattern(log_pattern, ai_text)

            return ai_text

    except Exception as exc:
        logger.error(f"DeepSeek API call failed: {exc}. Using fallback AI.")
        fallback_res = fallback_ai.predict(message)
        return (
            f"⚠️ **DeepSeek AI Offline (Using Fallback ML Model):**\n\n"
            f"{fallback_res['response']}\n\n"
            f"--- \n*Context retrieved from Elasticsearch:*\n{context}"
        )
