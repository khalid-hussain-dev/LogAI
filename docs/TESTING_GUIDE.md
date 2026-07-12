# Testing Guide

This guide describes what should be tested before final submission or demo.

## 1. Basic live verification

After starting the stack:

- open the frontend
- sign in
- create a server
- ingest logs with the server API key
- confirm live dashboard updates
- confirm logs search/filtering
- confirm alerts update
- confirm analytics update
- confirm integrations can save and send a test notification

## 2. Smoke testing

Run:

```bash
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY
```

If you have a JWT token:

```bash
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY --jwt-token YOUR_JWT
```

Expected result:

- backend health passes
- auth health passes
- ingest sample log passes
- protected endpoints pass if JWT is supplied

## 3. Load / performance testing

Run:

```bash
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15
```

Capture:

- total requests
- success/failure count
- throughput
- mean latency
- p50 latency
- p95 latency

## 4. Anomaly model validation

- stream at least `100` logs to activate the Isolation Forest
- verify anomalies still appear during warm-up
- verify anomalies still appear after warm-up
- verify `Alerts` and notification channels still behave correctly

## 5. Manual bug-bash checklist

- auth flow
- server CRUD
- ingest API
- live dashboard websocket updates
- logs filtering and pagination
- alerts updates
- analytics rendering
- chat response
- integrations save/test flow

## 6. Final evidence to collect

- screenshots of the main pages
- one smoke test result
- one load test result
- one anomaly example
- one architecture diagram slide
