# Phase 7 Testing Tools

This folder contains lightweight Phase 7 testing utilities for a running LogAI stack.

They are intentionally written with the Python standard library only, so they can be used even on a fresh machine once the containers are up.

## Files

- `smoke_test.py`: quick health and endpoint verification
- `ingest_load_test.py`: concurrent ingest benchmark for basic throughput and latency numbers

## Smoke test

Basic stack check:

```bash
python deploy/testing/smoke_test.py
```

With a server API key:

```bash
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY
```

With both an API key and a JWT token:

```bash
python deploy/testing/smoke_test.py --api-key YOUR_API_KEY --jwt-token YOUR_JWT
```

## Ingest load test

Run a simple concurrent benchmark:

```bash
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15
```

Save the summary report to a JSON file:

```bash
python deploy/testing/ingest_load_test.py --api-key YOUR_API_KEY --requests 300 --concurrency 15 --report-file deploy/testing/last-load-report.json
```

## Suggested reporting fields

For the final-year report or presentation, capture:

- total requests
- success and failure counts
- total test duration
- requests per second
- latency `mean`, `p50`, and `p95`
- any non-2xx status codes

## Practical note

These scripts do not replace full E2E automation, but they are a good Phase 7 hardening layer for:

- smoke validation before demos
- basic regression checks after backend changes
- collecting simple performance evidence for evaluation
