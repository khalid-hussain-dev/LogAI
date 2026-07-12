# Final Project Checklist

This checklist is for the final demo, final evaluation, and submission handoff.

## 1. Live verification before demo

- Start the backend stack with Docker.
- Start the active frontend.
- Confirm backend health and auth health.
- Create a server and store its API key safely.
- Send logs and confirm they appear live on the dashboard.
- Trigger at least one anomaly and verify the `Alerts` page updates.
- Configure one alert integration and send a test notification.
- Stream at least `100` logs so the Isolation Forest warm-up is complete.

## 2. Smoke and performance evidence

- Run `python deploy/testing/smoke_test.py`.
- Run `python deploy/testing/ingest_load_test.py --api-key ...`.
- Save at least one JSON benchmark report.
- Record basic latency and throughput values for the presentation/report.

## 3. Bug-bash checklist

- Auth login and callback flow
- Server creation and server list refresh
- API-key-based ingest
- Logs page search, filter, and pagination
- Dashboard live updates
- Alerts page live anomaly updates
- Integrations save and test-send flow
- Analytics charts and counts
- Chat page response behavior

## 4. Screenshot checklist

- Login page
- Dashboard overview
- Live logs in motion
- Logs filtering page
- Alerts page with anomalies
- Integrations page with configured channel
- Analytics page
- Docker Compose service stack

## 5. Presentation structure

1. Problem statement and motivation
2. Proposed scope versus implemented scope
3. Architecture overview
4. Mid-year completion summary
5. Final-year features added after mid-year
6. Live demo walkthrough
7. Performance and testing evidence
8. Challenges, tradeoffs, and future improvements

## 6. Nice-to-have final touches

- One real benchmark run with screenshots of the output
- One architecture slide using `docs/ARCHITECTURE.md`
- One short slide explaining the anomaly model warm-up and fallback behavior
- One slide listing pending future work such as advanced sequence models, hosted deployment, or deeper monitoring
