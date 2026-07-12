"""
Async Elasticsearch client + index creation with proper mappings.

The logai-logs index is created on application startup with optimized
field mappings for full-text search, keyword filtering, and aggregations.
"""

import logging
from elasticsearch import AsyncElasticsearch

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Singleton client ────────────────────────────────────────────────────────
_es_client: AsyncElasticsearch | None = None


def get_es_client() -> AsyncElasticsearch:
    """Return the shared async Elasticsearch client (lazy init)."""
    global _es_client
    if _es_client is None:
        _es_client = AsyncElasticsearch(
            hosts=[settings.ELASTICSEARCH_URL],
            request_timeout=30,
            max_retries=3,
            retry_on_timeout=True,
        )
    return _es_client


async def close_es_client():
    """Close the Elasticsearch client gracefully."""
    global _es_client
    if _es_client is not None:
        await _es_client.close()
        _es_client = None


# ── Index mappings ──────────────────────────────────────────────────────────
LOG_INDEX_MAPPINGS = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "log_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "stop"],
                }
            }
        },
    },
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "server_id": {"type": "keyword"},
            "server_name": {"type": "keyword"},
            "level": {"type": "keyword"},
            "message": {
                "type": "text",
                "analyzer": "log_analyzer",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
            },
            "source": {"type": "keyword"},
            "host": {"type": "keyword"},
            "service": {"type": "keyword"},
            "environment": {"type": "keyword"},
            "meta": {"type": "object", "dynamic": True},
            "raw": {"type": "text", "index": False},
            "anomaly": {"type": "boolean"},
            "anomaly_score": {"type": "float"},
            "timestamp": {
                "type": "date",
                "format": "epoch_millis||strict_date_optional_time",
            },
            "ingested_at": {
                "type": "date",
                "format": "strict_date_optional_time",
            },
            "processed_by": {"type": "keyword"},
        }
    },
}


async def ensure_log_index():
    """Create the logai-logs index if it doesn't exist."""
    es = get_es_client()
    index = settings.ELASTICSEARCH_INDEX_LOGS
    try:
        exists = await es.indices.exists(index=index)
        if not exists:
            await es.indices.create(index=index, body=LOG_INDEX_MAPPINGS)
            logger.info(f"Created Elasticsearch index: {index}")
        else:
            logger.info(f"Elasticsearch index already exists: {index}")
    except Exception as e:
        logger.error(f"Failed to create Elasticsearch index: {e}")
        raise

