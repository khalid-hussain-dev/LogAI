"""
Stream Worker — Two consumers running concurrently:

  1. Redis Stream consumer  (API-ingested logs via /api/v1/ingest → Redis Stream)
  2. Redis List consumer    (Fluentd-ingested logs via Fluentd → Redis List)

Both share the same processing pipeline:
    Parse → Anomaly Score → Elasticsearch → Redis Pub/Sub (WebSocket)

Runs as a separate container/process:
    python -m app.workers.stream_worker
"""

import asyncio
import json
import logging
import re
import signal
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from elasticsearch import AsyncElasticsearch

from app.core.config import settings
from app.db.elasticsearch import ensure_log_index, get_es_client, close_es_client
from app.db.redis_client import (
    ack_stream_message,
    close_redis_client,
    ensure_consumer_group,
    get_redis_client,
    publish_anomaly,
    publish_log,
    read_from_stream,
)
from app.services.anomaly_service import AnomalyService
from app.services.notification_service import dispatch_anomaly_notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [stream-worker] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────────────
STREAM_KEY = settings.REDIS_STREAM_INGEST
CONSUMER_GROUP = settings.REDIS_CONSUMER_GROUP
CONSUMER_NAME = f"worker-{uuid.uuid4().hex[:8]}"
INDEX = settings.ELASTICSEARCH_INDEX_LOGS
BATCH_SIZE = 50
ANOMALY_THRESHOLD = settings.ANOMALY_SCORE_THRESHOLD
FLUENTD_LIST_KEY = settings.REDIS_LIST_FLUENTD

anomaly_svc = AnomalyService()
running = True


# ═══════════════════════════════════════════════════════════════════════════
# LOG PARSERS — at least 4 formats
# ═══════════════════════════════════════════════════════════════════════════

# 1. Nginx combined log format
NGINX_PATTERN = re.compile(
    r'^(?P<host>\S+)\s+-\s+\S+\s+\[(?P<timestamp>[^\]]+)\]\s+'
    r'"(?P<method>\S+)\s+(?P<path>\S+)\s+\S+"\s+'
    r'(?P<status>\d+)\s+(?P<bytes>\d+)\s+'
    r'"(?P<referer>[^"]*)"\s+"(?P<user_agent>[^"]*)"'
)

# 2. Syslog format (RFC 3164)
SYSLOG_PATTERN = re.compile(
    r'^(?:<\d+>)?(?P<timestamp>\w{3}\s+\d+\s+\d+:\d+:\d+)\s+'
    r'(?P<host>\S+)\s+(?P<service>\S+?)(?:\[(?P<pid>\d+)\])?:\s+'
    r'(?P<message>.*)'
)

# 3. Python/Java standard logging format
PYLOG_PATTERN = re.compile(
    r'^(?P<timestamp>\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[.,]?\d*)\s+'
    r'(?:\[?(?P<level>DEBUG|INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\]?)\s+'
    r'(?:\[?(?P<source>[^\]]+)\]?\s+)?'
    r'(?P<message>.*)',
    re.IGNORECASE,
)

# 4. Docker / JSON structured format
DOCKER_PATTERN = re.compile(r'^\{.*\}$')


def parse_log_line(raw: str) -> Dict[str, Any]:
    """
    Parse a raw log line into a structured dict.
    Tries each format in order: JSON/Docker, Nginx, Python/Java, Syslog.
    Falls back to plain text if no pattern matches.
    """
    raw = raw.strip()
    if not raw:
        return {"message": "", "level": "info"}

    # ── Format 4: Docker / JSON structured ───────────────────
    if DOCKER_PATTERN.match(raw):
        try:
            data = json.loads(raw)
            return {
                "message": data.get("message") or data.get("msg") or data.get("log", raw),
                "level": _normalize_level(data.get("level") or data.get("severity", "info")),
                "source": data.get("source") or data.get("logger"),
                "host": data.get("host") or data.get("hostname"),
                "service": data.get("service") or data.get("container_name"),
                "environment": data.get("environment") or data.get("env"),
                "meta": {k: v for k, v in data.items()
                         if k not in ("message", "msg", "log", "level", "severity",
                                      "source", "logger", "host", "hostname",
                                      "service", "container_name", "environment", "env")},
            }
        except json.JSONDecodeError:
            pass

    # ── Format 1: Nginx combined ─────────────────────────────
    m = NGINX_PATTERN.match(raw)
    if m:
        status = int(m.group("status"))
        level = _level_from_status(status)
        return {
            "message": f'{m.group("method")} {m.group("path")} → {status}',
            "level": level,
            "host": m.group("host"),
            "source": "nginx",
            "meta": {
                "method": m.group("method"),
                "path": m.group("path"),
                "status_code": status,
                "bytes": int(m.group("bytes")),
                "referer": m.group("referer"),
                "user_agent": m.group("user_agent"),
            },
        }

    # ── Format 3: Python/Java standard ───────────────────────
    m = PYLOG_PATTERN.match(raw)
    if m:
        return {
            "message": m.group("message"),
            "level": _normalize_level(m.group("level")),
            "source": m.group("source"),
        }

    # ── Format 2: Syslog ────────────────────────────────────
    m = SYSLOG_PATTERN.match(raw)
    if m:
        message = m.group("message")
        return {
            "message": message,
            "level": _detect_level_from_content(message),
            "host": m.group("host"),
            "service": m.group("service"),
        }

    # ── Fallback: plain text ─────────────────────────────────
    return {
        "message": raw,
        "level": _detect_level_from_content(raw),
    }


def _normalize_level(level: str) -> str:
    """Normalize log level to one of: debug, info, warn, error, critical."""
    level = level.lower().strip()
    mapping = {
        "debug": "debug",
        "info": "info",
        "information": "info",
        "warn": "warn",
        "warning": "warn",
        "error": "error",
        "err": "error",
        "critical": "critical",
        "fatal": "critical",
        "crit": "critical",
        "emergency": "critical",
        "alert": "critical",
    }
    return mapping.get(level, "info")


def _level_from_status(status_code: int) -> str:
    """Detect log level from HTTP status code."""
    if status_code < 300:
        return "info"
    elif status_code < 400:
        return "info"
    elif status_code < 500:
        return "warn"
    else:
        return "error"


def _detect_level_from_content(message: str) -> str:
    """Detect log level from message content using keywords."""
    msg_lower = message.lower()
    if any(kw in msg_lower for kw in ("fatal", "critical", "panic", "crash", "oom")):
        return "critical"
    if any(kw in msg_lower for kw in ("error", "exception", "traceback", "failed", "failure")):
        return "error"
    if any(kw in msg_lower for kw in ("warn", "warning", "deprecated", "timeout")):
        return "warn"
    if any(kw in msg_lower for kw in ("debug", "trace", "verbose")):
        return "debug"
    return "info"


# ═══════════════════════════════════════════════════════════════════════════
# SHARED PROCESSING PIPELINE
# ═══════════════════════════════════════════════════════════════════════════

async def process_records(
    es: AsyncElasticsearch,
    records: List[Dict[str, Any]],
    source_label: str = "stream",
) -> int:
    """
    Shared processing pipeline used by BOTH stream consumer and list consumer.

    Each record dict must have:
      - raw: str          (raw log content)
      - server_id: str    (which server this log belongs to)
      - server_name: str  (human-readable server name)

    Pipeline: parse → anomaly score → build ES doc → bulk index → pub/sub.

    Returns the number of successfully processed records.
    """
    if not records:
        return 0

    operations = []
    count = 0

    for rec in records:
        try:
            raw = rec.get("raw", "")
            server_id = rec.get("server_id", "unknown")
            server_name = rec.get("server_name", "Unknown Server")

            # Try to parse as JSON first (structured log)
            try:
                data = json.loads(raw) if isinstance(raw, str) and raw.startswith("{") else None
            except (json.JSONDecodeError, TypeError):
                data = None

            if data and isinstance(data, dict):
                message = data.get("message") or data.get("msg") or data.get("log") or raw
                # Use explicit level if present, otherwise detect from message content
                explicit_level = data.get("level") or data.get("severity")
                if explicit_level:
                    level = _normalize_level(explicit_level)
                else:
                    level = _detect_level_from_content(message)

                parsed = {
                    "message": message,
                    "level": level,
                    "source": data.get("source"),
                    "host": data.get("host") or data.get("fluentd_host"),
                    "service": data.get("service"),
                    "environment": data.get("environment"),
                    "meta": data.get("meta") or {},
                }
                # Allow embedded overrides
                server_id = data.get("server_id", server_id)
                server_name = data.get("server_name", server_name)
            else:
                parsed = parse_log_line(raw)

            # Anomaly scoring
            score = anomaly_svc.score(
                server_id=server_id,
                level=parsed.get("level", "info"),
                message=parsed.get("message", ""),
                meta=parsed.get("meta") or {},
            )
            is_anomaly = score >= ANOMALY_THRESHOLD

            # Build ES document
            doc_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            doc = {
                "id": doc_id,
                "server_id": server_id,
                "server_name": server_name,
                "level": parsed.get("level", "info"),
                "message": parsed.get("message", ""),
                "source": parsed.get("source"),
                "host": parsed.get("host"),
                "service": parsed.get("service"),
                "environment": parsed.get("environment"),
                "meta": parsed.get("meta") or {},
                "raw": raw if isinstance(raw, str) else json.dumps(raw, default=str),
                "anomaly": is_anomaly,
                "anomaly_score": round(score, 4),
                "timestamp": int(now.timestamp() * 1000),
                "ingested_at": now.isoformat(),
                "processed_by": source_label,
            }

            operations.append({"index": {"_index": INDEX, "_id": doc_id}})
            operations.append(doc)

            # Publish to Redis pub/sub for WebSocket
            try:
                await publish_log(server_id, doc)
                if is_anomaly:
                    await publish_anomaly(server_id, doc)
            except Exception as e:
                logger.warning(f"Failed to publish to pub/sub: {e}")

            if is_anomaly:
                try:
                    await dispatch_anomaly_notifications(server_id, doc)
                except Exception as e:
                    logger.warning(f"Failed to send anomaly notifications: {e}")

            count += 1

        except Exception as e:
            logger.error(f"Error processing record: {e}")

    # Bulk index to Elasticsearch
    if operations:
        try:
            await es.bulk(operations=operations, refresh=False)
            logger.info(f"[{source_label}] Indexed {len(operations) // 2} logs to Elasticsearch")
        except Exception as e:
            logger.error(f"[{source_label}] Bulk index error: {e}")

    return count


# ═══════════════════════════════════════════════════════════════════════════
# CONSUMER 1: Redis Stream (API-ingested logs)
# ═══════════════════════════════════════════════════════════════════════════

async def stream_consumer_loop(es: AsyncElasticsearch):
    """Read from Redis Stream (populated by /api/v1/ingest) and process."""
    logger.info(f"Stream consumer starting: {STREAM_KEY} (group={CONSUMER_GROUP})")

    while running:
        try:
            result = await read_from_stream(
                STREAM_KEY, CONSUMER_GROUP, CONSUMER_NAME,
                count=BATCH_SIZE, block=2000,
            )

            if result:
                for stream_name, messages in result:
                    # Convert stream messages to generic records
                    records = []
                    msg_ids = []
                    for msg_id, fields in messages:
                        raw = fields.get("data", fields.get("message", ""))
                        records.append({
                            "raw": raw,
                            "server_id": fields.get("server_id", "unknown"),
                            "server_name": fields.get("server_name", "Unknown Server"),
                        })
                        msg_ids.append(msg_id)

                    await process_records(es, records, source_label="stream")

                    # ACK processed messages
                    for mid in msg_ids:
                        try:
                            await ack_stream_message(STREAM_KEY, CONSUMER_GROUP, mid)
                        except Exception as e:
                            logger.warning(f"Failed to ACK message {mid}: {e}")
            else:
                await asyncio.sleep(0.5)

        except Exception as e:
            logger.error(f"Stream consumer error: {e}")
            await asyncio.sleep(5)


# ═══════════════════════════════════════════════════════════════════════════
# CONSUMER 2: Redis List (Fluentd-ingested logs)
# ═══════════════════════════════════════════════════════════════════════════

async def list_consumer_loop(es: AsyncElasticsearch):
    """
    Read from Redis List (populated by Fluentd via fluent-plugin-redis-store)
    and process through the same pipeline.

    Fluentd pushes JSON strings to the list via RPUSH.
    We LPOP in batches for efficient processing (FIFO order).
    """
    logger.info(f"List consumer starting: watching {FLUENTD_LIST_KEY}")
    r = get_redis_client()

    while running:
        try:
            # Pop up to BATCH_SIZE items from the list
            items = await r.lpop(FLUENTD_LIST_KEY, count=BATCH_SIZE)

            if not items:
                await asyncio.sleep(1)
                continue

            # Convert list items (JSON strings) to generic records
            records = []
            for item in items:
                try:
                    data = json.loads(item) if isinstance(item, str) else item
                except (json.JSONDecodeError, TypeError):
                    data = {"message": str(item)}

                if isinstance(data, dict):
                    records.append({
                        "raw": json.dumps(data, default=str),
                        "server_id": data.get("server_id", "fluentd-default"),
                        "server_name": data.get("server_name", "Fluentd Collector"),
                    })
                else:
                    records.append({
                        "raw": str(data),
                        "server_id": "fluentd-default",
                        "server_name": "Fluentd Collector",
                    })

            processed = await process_records(es, records, source_label="fluentd")
            if processed > 0:
                logger.info(f"[fluentd] Processed {processed} logs from list")

        except Exception as e:
            logger.error(f"List consumer error: {e}")
            await asyncio.sleep(5)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN WORKER
# ═══════════════════════════════════════════════════════════════════════════

async def worker_loop():
    """Main worker — runs both stream and list consumers concurrently."""
    global running

    logger.info(f"Stream worker starting: consumer={CONSUMER_NAME}")
    logger.info(f"Stream: {STREAM_KEY}, Group: {CONSUMER_GROUP}")
    logger.info(f"Fluentd list: {FLUENTD_LIST_KEY}")

    # Initialize
    await ensure_consumer_group(STREAM_KEY, CONSUMER_GROUP)
    await ensure_log_index()

    es = get_es_client()

    # Run both consumers concurrently
    await asyncio.gather(
        stream_consumer_loop(es),
        list_consumer_loop(es),
    )

    logger.info("Stream worker stopped")


def handle_shutdown(signum, frame):
    """Handle graceful shutdown signals."""
    global running
    logger.info(f"Received signal {signum}, shutting down...")
    running = False


async def main():
    """Entry point for the stream worker."""
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        await worker_loop()
    finally:
        await close_es_client()
        await close_redis_client()
        logger.info("Stream worker cleanup complete")


if __name__ == "__main__":
    asyncio.run(main())
