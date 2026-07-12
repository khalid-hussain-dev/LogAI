#!/usr/bin/env python3
"""
Concurrent ingest performance test for a running LogAI deployment.

Uses only the Python standard library so it is easy to run after the stack
starts, even without an extra benchmarking tool installed.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import random
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from typing import Dict, List, Tuple


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run an ingest load test against LogAI.")
    parser.add_argument(
        "--ingest-url",
        default="http://localhost/api/v1/ingest",
        help="Public ingest endpoint URL.",
    )
    parser.add_argument("--api-key", required=True, help="Server API key.")
    parser.add_argument("--requests", type=int, default=200, help="Total requests to send.")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent workers.")
    parser.add_argument("--timeout", type=float, default=10.0, help="Per-request timeout in seconds.")
    parser.add_argument(
        "--report-file",
        default="",
        help="Optional JSON file to write the summary report to.",
    )
    return parser.parse_args()


def build_payload(index: int) -> Dict[str, object]:
    levels = ["info", "warn", "error", "critical"]
    level = levels[index % len(levels)]
    status_code = 200 if level == "info" else 504 if level in {"error", "critical"} else 429
    duration_ms = 40 + (index % 15) * 25
    message = (
        f"Phase 7 load-test log #{index} "
        f"level={level} duration={duration_ms}ms status={status_code}"
    )
    if level in {"error", "critical"}:
        message += " database timeout exception"

    return {
        "level": level,
        "message": message,
        "service": "phase7-load-test",
        "meta": {
            "source": "load-test",
            "status_code": status_code,
            "duration_ms": duration_ms,
            "batch": index // 25,
            "random": random.randint(1, 9999),
        },
    }


def post_log(ingest_url: str, api_key: str, timeout: float, index: int) -> Tuple[int, float, str]:
    payload = json.dumps(build_payload(index)).encode("utf-8")
    request = urllib.request.Request(
        ingest_url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
        },
    )

    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            duration_ms = (time.perf_counter() - start) * 1000
            return response.status, duration_ms, ""
    except urllib.error.HTTPError as exc:
        duration_ms = (time.perf_counter() - start) * 1000
        error_body = exc.read().decode("utf-8", errors="replace")[:160]
        return exc.code, duration_ms, error_body
    except Exception as exc:  # pragma: no cover - runtime/network dependent
        duration_ms = (time.perf_counter() - start) * 1000
        return 0, duration_ms, str(exc)


def percentile(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((pct / 100.0) * (len(ordered) - 1)))))
    return ordered[index]


def main() -> int:
    args = parse_args()

    total_start = time.perf_counter()
    results: List[Tuple[int, float, str]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as executor:
        futures = [
            executor.submit(post_log, args.ingest_url, args.api_key, args.timeout, index)
            for index in range(args.requests)
        ]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    total_duration = time.perf_counter() - total_start
    status_counts = Counter(status for status, _, _ in results)
    latencies = [duration for _, duration, _ in results]
    successes = sum(count for status, count in status_counts.items() if 200 <= status < 300)
    failures = len(results) - successes

    summary = {
        "requests": len(results),
        "concurrency": args.concurrency,
        "duration_seconds": round(total_duration, 3),
        "successes": successes,
        "failures": failures,
        "throughput_rps": round(len(results) / total_duration, 2) if total_duration else 0.0,
        "latency_ms": {
            "min": round(min(latencies), 2) if latencies else 0.0,
            "mean": round(statistics.mean(latencies), 2) if latencies else 0.0,
            "p50": round(percentile(latencies, 50), 2),
            "p95": round(percentile(latencies, 95), 2),
            "max": round(max(latencies), 2) if latencies else 0.0,
        },
        "status_counts": dict(sorted(status_counts.items())),
        "sample_errors": [error for status, _, error in results if status == 0 or status >= 400][:5],
    }

    print("LogAI ingest load test summary")
    print("=" * 72)
    print(json.dumps(summary, indent=2))

    if args.report_file:
        with open(args.report_file, "w", encoding="utf-8") as handle:
            json.dump(summary, handle, indent=2)
        print(f"Saved report to {args.report_file}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
