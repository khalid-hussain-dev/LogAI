# LogAI Mid-Year Demo Guide

This guide uses the current active frontend and the backend Docker stack.

## Active app paths

- Frontend: `LogAI-Frontend-Navroz-Frontend`
- Backend: `LogAI-Backend-main`
- Proposal/reference docs: `docs`
- Legacy assets: `legacy`

## 1. Start the backend stack

From `LogAI-Backend-main`:

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, Elasticsearch, FastAPI, the stream worker, auth service, Fluentd, and NGINX.

## 2. Start the active frontend

From `LogAI-Frontend-Navroz-Frontend`:

```bash
npm ci
npm run dev
```

Open the Vite URL in your browser.

## 3. Optional email alerting setup

Slack and generic webhooks can be configured directly from the `Integrations` page.

Email alerts also need SMTP settings on the backend, for example:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=alerts@example.com
SMTP_PASSWORD=change-me
SMTP_FROM_EMAIL=alerts@example.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

Add those to the backend environment before starting the stack if you want email tests to succeed.

## 4. Demo checklist

1. Sign in or create an account.
2. Create a server from the `Servers` page.
3. Copy the server API key.
4. Send a sample log using the ingest API.
5. Open the dashboard and confirm the log appears in `Live Logs` without refresh.
6. Open `Logs` and confirm filtering/search works.
7. Open `Alerts` and confirm anomalies appear when applicable.
8. Open `Integrations`, save a Slack/webhook channel, and send a test alert.
9. Keep streaming logs until at least `100` logs have been processed if you want to demonstrate the Isolation Forest model after its warm-up phase.

## 5. Sample ingest command

Replace `YOUR_API_KEY` with a server key from the dashboard:

```bash
curl -X POST http://localhost/api/v1/ingest ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: YOUR_API_KEY" ^
  -d "{\"level\":\"error\",\"message\":\"Database timeout on checkout flow\",\"service\":\"demo-app\"}"
```

If you are hitting the FastAPI service directly instead of NGINX, use `http://localhost:8000`.

For the Phase 6 ML demo, repeat the ingest call or send a small batch so the anomaly model can collect enough samples to train.

## 6. Health checks

- Backend health: `http://localhost:8000/health`
- Auth service health: `http://localhost:4001/api/auth/health`

## 7. CI/CD starter

The basic pipeline lives at:

- `.github/workflows/ci.yml`

It validates:

- active frontend build
- backend Python compilation/import
- auth service syntax
- Docker image builds

## 8. Supported deployment path

The current FYP build uses Docker Compose for the runnable local/demo deployment. The backend Compose stack starts the API, worker, auth service, PostgreSQL, Redis, Elasticsearch, Fluentd, and NGINX, while the frontend runs through Vite during development.
