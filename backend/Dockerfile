# ============================================================
# LogAI Backend — Multi-stage Dockerfile
# ============================================================
# Targets:
#   development  — hot-reload with uvicorn --reload
#   production   — 4 uvicorn workers, no reload
# ============================================================

# ── Base ─────────────────────────────────────────────────────
FROM python:3.11-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl libgomp1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ── Development ──────────────────────────────────────────────
FROM base AS development
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production ───────────────────────────────────────────────
FROM base AS production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
