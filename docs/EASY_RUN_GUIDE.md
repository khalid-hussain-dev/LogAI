# LogAI Easy Step-by-Step Run Guide

This guide is the recommended way to run the current LogAI project. The supported local/demo setup is Docker Compose for the backend stack plus Vite for the active React frontend.

## 1. What You Need

Install these before starting:

- Docker Desktop with Docker Compose support
- Node.js 18 or newer
- npm
- Python 3.11 or newer if you want to run the smoke/load test scripts

Optional credentials:

- SMTP credentials for email alert testing
- Slack incoming webhook URL for Slack alert testing
- Generic webhook URL if you want to test webhook alert delivery
- Google/GitHub OAuth credentials if you want OAuth login

## 2. Project Folders

Use these folders during normal development and demo runs:

- Backend stack: `LogAI-Backend-main`
- Active frontend: `LogAI-Frontend-Navroz-Frontend`
- Test utilities: `deploy/testing`
- Project docs: `docs`

The `legacy` folder is only a reference snapshot and is not part of the active app.

## 3. Open The Workspace

Open PowerShell in the project root:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard"
```

Expected result:

- You should see folders like `LogAI-Backend-main`, `LogAI-Frontend-Navroz-Frontend`, `deploy`, and `docs`.

## 4. Prepare The Backend Environment

Move into the backend folder:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard\LogAI-Backend-main"
```

Create `.env` from the example if it does not already exist:

```powershell
Copy-Item env.example .env
```

Open `.env` and check these values:

- `JWT_SECRET_KEY`: replace the placeholder before a final demo if possible
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: defaults are fine for local demo use
- `REDIS_PASSWORD`: defaults are fine for local demo use
- `ELASTICSEARCH_URL`: should stay `http://elasticsearch:9200` inside Docker
- `FRONTEND_URL`: should be `http://localhost:5173`
- `SMTP_*`: required only for email alert tests
- `GOOGLE_*` and `GITHUB_*`: required only for OAuth login

Expected result:

- `LogAI-Backend-main\.env` exists.
- Required local defaults are present.
- Optional credentials can remain empty unless you need those integrations.

## 5. Start The Backend Stack

From `LogAI-Backend-main`, run:

```powershell
docker compose up -d --build
```

This starts:

- PostgreSQL on `5432`
- Redis on `6379`
- Elasticsearch on `9200`
- FastAPI backend on `8000`
- Stream worker
- Node auth service on `4001`
- Fluentd on `24224`, `9880`, and `5140/udp`
- NGINX reverse proxy on `80`

Expected result:

- Docker builds the backend, auth service, and Fluentd images.
- Containers start without repeatedly restarting.
- The command returns to the terminal after startup.

Check running containers:

```powershell
docker compose ps
```

Expected result:

- Core services should show as running or healthy.
- Elasticsearch may take a little longer on the first run.

## 6. Run Database Migrations

After the backend container is running, apply migrations:

```powershell
docker compose exec backend alembic upgrade head
```

Expected result:

- Alembic completes without an error.
- Tables for users, servers, and alert integrations are available in PostgreSQL.

## 7. Check Backend Health

Open these URLs in your browser:

```text
http://localhost:8000/health
http://localhost:4001/api/auth/health
http://localhost:8000/docs
```

Expected result:

- FastAPI health returns a healthy response.
- Auth service health returns a healthy response.
- FastAPI Swagger docs load at `/docs`.

You can also use PowerShell:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:4001/api/auth/health
```

## 8. Start The Frontend

Open a second PowerShell terminal:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard\LogAI-Frontend-Navroz-Frontend"
npm install
npm run dev
```

Expected result:

- npm installs frontend dependencies.
- Vite starts successfully.
- The terminal shows a local URL, usually `http://localhost:5173`.

Open:

```text
http://localhost:5173
```

Expected result:

- The LogAI frontend loads.
- The app can reach backend APIs through the Vite proxy.

## 9. Create A User And Server

In the frontend:

1. Sign up with a test email and password.
2. Open the `Servers` page.
3. Create a new server, for example `Demo App`.
4. Copy the generated API key.

Expected result:

- Signup/login succeeds.
- You can access protected dashboard pages.
- The new server appears in the server list.
- You have an API key for ingesting logs.

## 10. Send A Sample Log

Replace `YOUR_API_KEY` with the server API key:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-api-key" = "YOUR_API_KEY"
}

$body = @{
  level = "error"
  message = "Database timeout on checkout flow"
  service = "demo-app"
  meta = @{
    status_code = 500
    duration_ms = 850
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost/api/v1/ingest" -Headers $headers -Body $body
```

Expected result:

- The API returns a successful ingest response.
- The new log is stored in Elasticsearch.
- The dashboard receives the log through the live WebSocket path.

## 11. Verify The Main Pages

Check the frontend pages:

- `Dashboard`: overview cards load and the sample log appears in live logs.
- `Logs`: the sample log is searchable and filters work.
- `Alerts`: anomaly entries appear when the anomaly score crosses the threshold.
- `Analytics`: hourly activity, severity distribution, error counts, and anomaly counts update from backend data.
- `Servers`: created servers show stats and API key actions.
- `Integrations`: Slack, email, and webhook settings can be saved and test alerts can be sent.
- `Chat`: the chat feature answers using recent indexed log context.

Expected result:

- Navigation works without forced refreshes.
- API-backed pages show real backend data rather than placeholder-only content.
- Live dashboard updates appear without manually refreshing the browser.

## 12. Test Alert Integrations

Open the `Integrations` page.

For Slack:

- Enable Slack alerts.
- Add a Slack incoming webhook URL.
- Save settings.
- Send a test alert.

For generic webhook:

- Enable webhook alerts.
- Add your webhook receiver URL.
- Save settings.
- Send a test alert.

For email:

- Add SMTP values to `.env`.
- Restart the backend stack.
- Enable email alerts in the UI.
- Add recipient addresses.
- Send a test alert.

Expected result:

- Saved settings reload correctly.
- Test alerts show a success message when credentials are valid.
- Invalid or missing credentials produce a visible error instead of silently failing.

## 13. Warm Up The AI Model

The Isolation Forest model needs training samples before it becomes active. Send at least `100` logs to warm it up.

Until warm-up is complete:

- The fallback statistical anomaly detector still runs.
- Alerts can still appear based on heuristic scoring.

After warm-up:

- Isolation Forest becomes the primary anomaly scorer.
- Alerts and analytics continue to update through the same dashboard flow.

## 14. Run Smoke Testing

From the workspace root:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard"
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY
```

If you have a JWT token:

```powershell
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY --jwt-token YOUR_JWT
```

Expected result:

- Backend health check passes.
- Auth service health check passes.
- Sample ingest passes when an API key is supplied.
- Protected endpoint checks pass when a JWT token is supplied.

## 15. Run A Simple Load Test

From the workspace root:

```powershell
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15
```

Save a JSON report:

```powershell
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15 --report-file deploy/testing/last-load-report.json
```

Expected result:

- Most or all requests return successful status codes.
- The script prints throughput, latency, and status counts.
- `last-load-report.json` is created if `--report-file` is used.
- Dashboard, logs, alerts, and analytics reflect the generated traffic after Elasticsearch finishes indexing.

## 16. Useful Logs

Backend logs:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard\LogAI-Backend-main"
docker compose logs -f backend
```

Stream worker logs:

```powershell
docker compose logs -f stream-worker
```

Auth service logs:

```powershell
docker compose logs -f auth-service
```

All service logs:

```powershell
docker compose logs -f
```

Expected result:

- Backend logs show API requests and application startup.
- Stream worker logs show queued log processing when Fluentd or stream-based ingestion is used.
- Auth service logs show OAuth/auth route activity.

## 17. Stop The Project

Stop containers:

```powershell
cd "E:\LogAI -- Log Monitoring Dashboard\LogAI-Backend-main"
docker compose down
```

Stop and remove local volumes if you want a clean database and Elasticsearch state:

```powershell
docker compose down -v
```

Expected result:

- `docker compose down` stops the backend stack but keeps data volumes.
- `docker compose down -v` removes saved database, Redis, Elasticsearch, and Fluentd buffer data.

## 18. Common Problems

Docker containers keep restarting:

- Run `docker compose logs -f backend`.
- Confirm `.env` exists.
- Confirm Docker Desktop has enough memory for Elasticsearch.

Frontend cannot reach the API:

- Confirm `docker compose ps` shows backend and auth service running.
- Confirm `http://localhost:8000/health` works.
- Confirm Vite is running on `http://localhost:5173`.

Signup or login fails:

- Run migrations with `docker compose exec backend alembic upgrade head`.
- Check backend logs.
- Confirm PostgreSQL is healthy.

Logs do not appear:

- Confirm the API key belongs to an active server.
- Check the `Logs` page after a few seconds.
- Check Elasticsearch health at `http://localhost:9200/_cluster/health`.

Alerts do not appear:

- Send an error-level or suspicious log message.
- Lower `ANOMALY_SCORE_THRESHOLD` in `.env` for demo testing if needed.
- Restart the backend after changing `.env`.

Email test fails:

- Confirm all `SMTP_*` values are set.
- Confirm the SMTP provider allows app passwords or SMTP login.
- Check backend logs for the exact SMTP error.

## 19. Final Demo Success Criteria

The project is ready to demonstrate when:

- Backend, auth service, Redis, PostgreSQL, Elasticsearch, Fluentd, and NGINX are running.
- Frontend opens at `http://localhost:5173`.
- Signup/login works.
- A server can be created and an API key copied.
- Logs can be ingested through `http://localhost/api/v1/ingest`.
- Dashboard updates live through WebSockets.
- Logs page search and filtering work.
- Alerts page shows anomaly activity.
- Analytics page shows real backend-driven charts.
- At least one integration test alert succeeds.
- Smoke test passes.
- Load test produces a usable throughput and latency report.
