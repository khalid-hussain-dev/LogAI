# LogAI

LogAI is a full-stack log monitoring platform that combines ingestion, anomaly detection, live updates, search, server management, and alert delivery in a single workspace.

This repository is organized as a project workspace rather than a single app. The active system is split into a backend stack in `LogAI-Backend-main` and a React frontend in `LogAI-Frontend-Navroz-Frontend`, with deployment assets, testing utilities, and reference docs living alongside them.

## What This Workspace Contains

| Path | Role |
| --- | --- |
| `LogAI-Backend-main` | Active backend stack: FastAPI API, Redis stream worker, Node OAuth service, Fluentd, Docker Compose, PostgreSQL, Elasticsearch, Redis, and NGINX config |
| `LogAI-Frontend-Navroz-Frontend` | Active React + Vite dashboard frontend |
| `deploy` | Docker Compose demo notes and testing utilities |
| `docs` | Architecture notes, run guides, model notes, and supporting project documentation |
| `legacy` | Older frontend snapshot retained for reference only |

## Core Capabilities

- User authentication with email/password JWT auth and Google/GitHub OAuth
- Server registration with per-server API keys
- Single-log and batch-log ingestion over REST
- Fluentd-based ingestion for forward, HTTP, and syslog sources
- Elasticsearch-backed log search, metrics, analytics, and chat context
- Real-time dashboard updates over Redis Pub/Sub and WebSockets
- Anomaly scoring with a statistical fallback and Isolation Forest warm-up path
- Outbound alerts through Slack, email, and generic webhooks
- Demo, smoke-test, and load-test utilities for validation

## System Overview

LogAI currently runs as two coordinated application layers:

1. `LogAI-Backend-main` provides the backend services and infrastructure entry points.
2. `LogAI-Frontend-Navroz-Frontend` provides the user-facing dashboard used to manage servers, inspect logs, view analytics, and configure integrations.

The runtime stack includes:

| Service | Responsibility | Default port |
| --- | --- | --- |
| FastAPI backend | REST API, JWT auth, server management, logs, analytics, chat, integrations, WebSocket endpoint | `8000` |
| Stream worker | Shared processing pipeline for queued logs | n/a |
| Node auth service | Google/GitHub OAuth callback flow and token issuance | `4001` |
| PostgreSQL | Users, servers, and integration settings | `5432` |
| Elasticsearch | Log storage, search, aggregations, analytics, and chat context | `9200` |
| Redis | Streams, lists, Pub/Sub, and rate limiting | `6379` |
| Fluentd | Forward, HTTP, and syslog collection | `24224`, `9880`, `5140/udp` |
| NGINX | Unified reverse proxy for backend, auth service, docs, and WebSocket traffic | `80` |
| React frontend | Dashboard UI during local development via Vite | `5173` |

For the architecture flow diagram and reusable Mermaid source, see:

- [Architecture Guide](docs/ARCHITECTURE.md)
- [Mermaid Source](docs/ARCHITECTURE_FLOW.mmd)

## How LogAI Works

### 1. User and dashboard flow

- The React frontend calls FastAPI for credential auth, server management, logs, analytics, alerts, and chat.
- OAuth sign-in is handled by the separate Node auth service and then redirected back to the frontend with JWT tokens.
- During local frontend development, Vite proxies `/api/v1`, `/api/auth`, and `/ws` to the backend stack.
- In the Docker-backed demo path, NGINX exposes the backend stack behind `http://localhost`.

### 2. Log ingestion flow

There are two active ingestion paths in the current codebase:

- Direct API ingest:
  - Clients send logs to `POST /api/v1/ingest` or `POST /api/v1/ingest/batch` using `x-api-key`.
  - FastAPI validates the server, scores the log, stores it in Elasticsearch, and records an event on Redis.
- Collector-based ingest:
  - Fluentd accepts forward, HTTP, and syslog inputs.
  - Fluentd enriches records and pushes them to the Redis list `logai:list:fluentd`.
  - The Python stream worker consumes queued records, parses them, scores anomalies, stores them in Elasticsearch, publishes live events to Redis Pub/Sub, and dispatches notifications when needed.

### 3. Query and live-update flow

- Dashboard, Logs, Analytics, Alerts, and Chat pages query FastAPI.
- FastAPI reads structured data and aggregations from Elasticsearch.
- The WebSocket endpoint at `/ws` subscribes to Redis Pub/Sub channels and pushes live log/anomaly events to the browser.

## Frontend Features

The active frontend includes the following shipped pages and flows:

| Area | Current behavior |
| --- | --- |
| Authentication | Email/password sign-up and login, protected routes, OAuth callback handling, token refresh |
| Dashboard | 24-hour overview cards, live logs panel, anomaly summary, and per-server status |
| Analytics | Hourly charts for logs/errors/anomalies plus severity distribution |
| Logs | Search, server filter, severity filter, anomaly-only mode, and pagination |
| Alerts | Live anomaly feed using the WebSocket stream plus historical anomaly browsing |
| Servers | Create servers, copy API keys, rotate keys, delete servers |
| Integrations | Configure Slack, email, and webhook delivery plus send test alerts |
| Chat | Chat-style interface backed by Elasticsearch context from recent logs |
| API Reference | Built-in UI summary of the main REST endpoints |

## Tech Stack

### Frontend

- React 18
- Vite
- React Router
- Tailwind CSS
- Framer Motion
- Recharts

### Backend

- FastAPI
- SQLAlchemy async + Alembic
- PostgreSQL
- Elasticsearch
- Redis
- Fluentd
- Node.js + Passport for OAuth
- scikit-learn Isolation Forest for anomaly detection

### DevOps and tooling

- Docker and Docker Compose
- NGINX reverse proxy
- GitHub Actions CI starter workflow
- Python-based smoke and ingest load tests in `deploy/testing`

## Quick Start

### Prerequisites

- Docker Desktop or Docker Engine with Compose support
- Node.js 18+ and npm
- Python 3.11+ if you want to run testing tools or the shipper locally

### 1. Prepare the backend environment

From the workspace root:

```powershell
cd LogAI-Backend-main
copy env.example .env
```

Update `.env` before first use. At minimum, review:

- `JWT_SECRET_KEY`
- `POSTGRES_*`
- `REDIS_*`
- `ELASTICSEARCH_URL`
- `SMTP_*` if you want email alert tests
- `GOOGLE_*` and `GITHUB_*` if you want OAuth login

### 2. Start the backend stack

```powershell
docker compose up -d --build
```

This starts PostgreSQL, Elasticsearch, Redis, FastAPI, the stream worker, the auth service, Fluentd, and NGINX.

### 3. Run database migrations

```powershell
docker compose exec backend alembic upgrade head
```

### 4. Start the frontend

Open a second terminal:

```powershell
cd ..\LogAI-Frontend-Navroz-Frontend
npm install
npm run dev
```

Vite will usually serve the UI at `http://localhost:5173`.

### 5. Verify the services

- Frontend: `http://localhost:5173`
- FastAPI health: `http://localhost:8000/health`
- FastAPI docs: `http://localhost:8000/docs`
- Auth service health: `http://localhost:4001/api/auth/health`
- NGINX entry point: `http://localhost`

### 6. Create a server and send a sample log

1. Sign up in the UI.
2. Open the `Servers` page.
3. Create a server and copy its API key.

Then send a sample log through NGINX:

```powershell
curl -X POST http://localhost/api/v1/ingest `
  -H "Content-Type: application/json" `
  -H "x-api-key: YOUR_API_KEY" `
  -d "{\"level\":\"error\",\"message\":\"Database timeout on checkout flow\",\"service\":\"demo-app\",\"meta\":{\"status_code\":500,\"duration_ms\":850}}"
```

If you want to hit FastAPI directly, use `http://localhost:8000/api/v1/ingest`.

### 7. Optional validation

From the workspace root:

```powershell
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15
```

## Primary API Surface

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | None | Register a user |
| `POST` | `/api/v1/auth/login` | None | Login with email and password |
| `POST` | `/api/v1/auth/refresh` | None | Refresh access token |
| `GET` | `/api/v1/auth/me` | JWT | Get the current user |
| `POST` | `/api/v1/ingest` | API key | Ingest one log entry |
| `POST` | `/api/v1/ingest/batch` | API key | Ingest up to 1000 logs |
| `GET` | `/api/v1/logs` | JWT | Search and filter logs |
| `GET` | `/api/v1/servers` | JWT | List user servers with 24h stats |
| `GET` | `/api/v1/servers/{id}/metrics` | JWT | Fetch per-server metrics |
| `GET` | `/api/v1/servers/dashboard/overview` | JWT | Fetch aggregated dashboard metrics |
| `POST` | `/api/v1/chat` | JWT | Query recent log context |
| `GET` | `/api/v1/integrations/alerts` | JWT | Read alert channel settings |
| `PUT` | `/api/v1/integrations/alerts` | JWT | Update alert channel settings |
| `POST` | `/api/v1/integrations/alerts/test` | JWT | Send a test notification |
| `WS` | `/ws?token=<JWT>&server_id=<id>` | JWT | Subscribe to real-time events |
| `GET` | `/api/auth/google` | None | Start Google OAuth |
| `GET` | `/api/auth/github` | None | Start GitHub OAuth |

## Repository Map

```text
LogAI -- Log Monitoring Dashboard/
|-- README.md
|-- LogAI-Backend-main/
|   |-- docker-compose.yml
|   |-- env.example
|   |-- backend/
|   |   `-- app/
|   |-- auth-service/
|   |-- fluentd/
|   |-- docker/
|   `-- shipper/
|-- LogAI-Frontend-Navroz-Frontend/
|   |-- src/
|   |-- Dockerfile
|   `-- vite.config.js
|-- deploy/
|   |-- LOCAL_DEMO.md
|   `-- testing/
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- ARCHITECTURE_FLOW.mmd
|   |-- ANOMALY_MODEL_FLOW.md
|   |-- EASY_RUN_GUIDE.md
|   `-- TESTING_GUIDE.md
`-- legacy/
```

## Testing, CI, and Deployment Assets

### Testing utilities

- `deploy/testing/smoke_test.py` checks health and selected endpoints
- `deploy/testing/ingest_load_test.py` generates a simple concurrent ingest benchmark
- `deploy/testing/README.md` explains the expected usage and reporting fields

### CI starter

`.github/workflows/ci.yml` currently validates:

- active frontend build
- backend dependency install and importability
- auth-service syntax
- Docker image builds

### Deployment assets

- `deploy/LOCAL_DEMO.md` documents the preferred local demo flow
- `LogAI-Frontend-Navroz-Frontend/Dockerfile` builds the frontend as a static NGINX site
- `LogAI-Backend-main/docker/nginx/nginx.conf` provides the reverse-proxy entry point used by the backend stack

## Useful Docs

- [Architecture Flow](docs/ARCHITECTURE.md)
- [Mermaid Diagram Source](docs/ARCHITECTURE_FLOW.mmd)
- [Anomaly Model Flow](docs/ANOMALY_MODEL_FLOW.md)
- [Easy Run Guide](docs/EASY_RUN_GUIDE.md)
- [Local Demo Guide](deploy/LOCAL_DEMO.md)
- [Testing Tools README](deploy/testing/README.md)

## Troubleshooting

### Backend does not come up cleanly

Check the core containers:

```powershell
cd LogAI-Backend-main
docker compose logs -f backend
docker compose logs -f stream-worker
docker compose logs -f auth-service
docker compose logs -f fluentd
```

### Frontend cannot reach the API

- Make sure the backend stack is running
- Make sure the frontend is running on the Vite port
- Confirm `vite.config.js` is proxying `/api/v1`, `/api/auth`, and `/ws`

### OAuth login fails

- Verify `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` or `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- Verify the callback URLs match the values configured in the provider dashboard
- Check `http://localhost:4001/api/auth/health`

### Email alert tests fail

Email delivery requires SMTP configuration in the backend environment:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

### Logs are not showing where expected

- Confirm the server API key is valid
- Confirm logs are indexed in Elasticsearch
- Confirm the stream worker is running for queued ingestion paths
- Use the `Logs` page to verify persistence even if the live stream is not yet connected

## Notes

- The active code paths are the backend workspace in `LogAI-Backend-main` and the frontend workspace in `LogAI-Frontend-Navroz-Frontend`.
- The `legacy` folder is reference material and should not be treated as the primary frontend.
- The architecture doc intentionally separates direct API ingestion from collector-based worker ingestion so the data flow reflects the current implementation.
