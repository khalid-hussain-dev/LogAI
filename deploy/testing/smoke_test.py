#!/usr/bin/env python3
"""
Lightweight Phase 7 smoke test for a running LogAI stack.

This script uses only the Python standard library so it can run in a fresh
environment once the containers are up.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class CheckResult:
    name: str
    ok: bool
    status_code: Optional[int]
    detail: str
    duration_ms: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run LogAI smoke checks against a live stack.")
    parser.add_argument("--backend-url", default="http://localhost:8000", help="FastAPI backend base URL.")
    parser.add_argument("--auth-url", default="http://localhost:4001", help="Auth service base URL.")
    parser.add_argument(
        "--ingest-url",
        default="http://localhost/api/v1/ingest",
        help="Public ingest endpoint URL.",
    )
    parser.add_argument(
        "--batch-ingest-url",
        default="",
        help="Public batch ingest endpoint URL. Defaults to --ingest-url plus /batch.",
    )
    parser.add_argument("--api-key", default="", help="Server API key for ingest smoke test.")
    parser.add_argument("--jwt-token", default="", help="JWT for authenticated API smoke checks.")
    parser.add_argument("--timeout", type=float, default=10.0, help="Per-request timeout in seconds.")
    return parser.parse_args()


def request_json(
    name: str,
    url: str,
    timeout: float,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    payload: Optional[dict] = None,
) -> CheckResult:
    start = time.perf_counter()
    body = None
    request_headers = headers or {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **request_headers}

    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            duration_ms = (time.perf_counter() - start) * 1000
            raw = response.read().decode("utf-8", errors="replace")
            detail = raw[:200].strip() or "OK"
            return CheckResult(name, True, response.status, detail, duration_ms)
    except urllib.error.HTTPError as exc:
        duration_ms = (time.perf_counter() - start) * 1000
        detail = exc.read().decode("utf-8", errors="replace")[:200].strip() or str(exc)
        return CheckResult(name, False, exc.code, detail, duration_ms)
    except Exception as exc:  # pragma: no cover - runtime/network dependent
        duration_ms = (time.perf_counter() - start) * 1000
        return CheckResult(name, False, None, str(exc), duration_ms)


def run_checks(args: argparse.Namespace) -> List[CheckResult]:
    checks: List[CheckResult] = []

    checks.append(
        request_json(
            name="Backend health",
            url=f"{args.backend_url.rstrip('/')}/health",
            timeout=args.timeout,
        )
    )
    checks.append(
        request_json(
            name="Auth health",
            url=f"{args.auth_url.rstrip('/')}/api/auth/health",
            timeout=args.timeout,
        )
    )

    if args.api_key:
        batch_ingest_url = args.batch_ingest_url or f"{args.ingest_url.rstrip('/')}/batch"
        checks.append(
            request_json(
                name="Ingest sample log",
                url=args.ingest_url,
                timeout=args.timeout,
                method="POST",
                headers={"x-api-key": args.api_key},
                payload={
                    "level": "error",
                    "message": "Phase 7 smoke test log",
                    "service": "phase7-smoke",
                    "meta": {"source": "smoke-test", "status_code": 500},
                },
            )
        )
        checks.append(
            request_json(
                name="Batch ingest logs",
                url=batch_ingest_url,
                timeout=args.timeout,
                method="POST",
                headers={"x-api-key": args.api_key},
                payload={
                    "logs": [
                        {
                            "level": "info",
                            "message": "Phase 7 batch smoke test log",
                            "service": "phase7-smoke",
                            "meta": {"source": "smoke-test", "status_code": 200},
                        },
                        {
                            "level": "critical",
                            "message": "Phase 7 batch smoke test critical timeout exception",
                            "service": "phase7-smoke",
                            "meta": {"source": "smoke-test", "status_code": 500, "duration_ms": 2400},
                        },
                    ],
                },
            )
        )

    if args.jwt_token:
        auth_headers = {"Authorization": f"Bearer {args.jwt_token}"}
        checks.append(
            request_json(
                name="Servers endpoint",
                url=f"{args.backend_url.rstrip('/')}/api/v1/servers",
                timeout=args.timeout,
                headers=auth_headers,
            )
        )
        checks.append(
            request_json(
                name="Logs endpoint",
                url=f"{args.backend_url.rstrip('/')}/api/v1/logs?limit=5",
                timeout=args.timeout,
                headers=auth_headers,
            )
        )

    return checks


def print_report(results: List[CheckResult]) -> int:
    failures = 0

    print("LogAI smoke test report")
    print("=" * 72)
    for result in results:
        status_label = "PASS" if result.ok else "FAIL"
        status_code = result.status_code if result.status_code is not None else "-"
        print(
            f"[{status_label}] {result.name:<20} "
            f"status={status_code:<3} "
            f"time={result.duration_ms:7.2f} ms "
            f"detail={result.detail}"
        )
        if not result.ok:
            failures += 1

    print("=" * 72)
    print(f"Checks run: {len(results)}")
    print(f"Failures:   {failures}")
    return 1 if failures else 0


def main() -> int:
    args = parse_args()
    results = run_checks(args)
    return print_report(results)


if __name__ == "__main__":
    sys.exit(main())
