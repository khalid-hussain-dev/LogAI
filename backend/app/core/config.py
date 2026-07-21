"""
Application configuration via pydantic-settings.

Reads all values from environment variables / .env file.
Every config value is typed and documented.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Typed application settings — populated from environment variables."""

    # ── App ──────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_VERSION: str = "0.1.0"

    # ── PostgreSQL ───────────────────────────────────────────
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "logai"
    POSTGRES_USER: str = "logai"
    POSTGRES_PASSWORD: str = "logai_secret_2025"
    DATABASE_URL: str = "postgresql+asyncpg://logai:logai_secret_2025@postgres:5432/logai"

    # ── Elasticsearch ────────────────────────────────────────
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    ELASTICSEARCH_INDEX_LOGS: str = "logai-logs"

    # ── Redis ────────────────────────────────────────────────
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = "logai_redis_2025"
    REDIS_URL: str = "redis://:logai_redis_2025@redis:6379/0"
    REDIS_STREAM_INGEST: str = "logai:stream:ingest"
    REDIS_STREAM_PROCESSED: str = "logai:stream:processed"
    REDIS_CONSUMER_GROUP: str = "logai-workers"
    REDIS_LIST_FLUENTD: str = "logai:list:fluentd"

    # ── JWT ──────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE_ME"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── OAuth ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:4001/api/auth/google/callback"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:4001/api/auth/github/callback"

    # ── Services ─────────────────────────────────────────────
    AUTH_SERVICE_PORT: int = 4001
    FRONTEND_URL: str = "http://localhost:5173"
    SESSION_SECRET: str = "dev_session_secret_change_me"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    ALERTS_EMAIL_SUBJECT_PREFIX: str = "[LogAI Alert]"
    NOTIFICATION_REQUEST_TIMEOUT_SECONDS: int = 10

    # ── DeepSeek AI ──────────────────────────────────────────
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    DEEPSEEK_MAX_TOKENS: int = 1024

    # ── CORS ─────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── Rate Limiting ────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 120
    INGEST_RATE_LIMIT_PER_MINUTE: int = 2000

    # ── Anomaly ──────────────────────────────────────────────
    ANOMALY_SCORE_THRESHOLD: float = 0.5
    ANOMALY_WINDOW_SECONDS: int = 60
    ANOMALY_USE_ISOLATION_FOREST: bool = True
    ANOMALY_MIN_TRAIN_SAMPLES: int = 100
    ANOMALY_RETRAIN_INTERVAL: int = 500
    ANOMALY_MAX_TRAIN_BUFFER: int = 4000
    ANOMALY_IFOREST_ESTIMATORS: int = 200
    ANOMALY_IFOREST_CONTAMINATION: float = 0.05
    ANOMALY_IFOREST_RANDOM_STATE: int = 42

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Singleton — import this everywhere
settings = Settings()
