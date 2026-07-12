#!/usr/bin/env python3
"""
LogAI Shipper Demo - realistic web application simulation.

Generates realistic log entries from several services and endpoints. The normal
distribution is mostly info/warn logs, with periodic error spikes to exercise
the anomaly detector.

Usage:
    python demo.py --key logai-xxxx --server http://localhost:8000 --interval 0.5
"""

import argparse
import random
import time

from logai_shipper import LogAIShipper


SERVICES = ["api-gateway", "auth-service", "order-service", "payment-service", "user-service"]
HOSTS = ["web-01.prod", "web-02.prod", "api-01.prod", "worker-01.prod"]
ENVIRONMENTS = ["production", "staging"]
ENDPOINTS = [
    "/api/users",
    "/api/orders",
    "/api/products",
    "/api/auth/login",
    "/api/payments/process",
    "/api/health",
    "/api/v1/search",
    "/api/cart",
    "/api/checkout",
    "/api/inventory",
]

INFO_MESSAGES = [
    "Request processed successfully for {endpoint} in {duration}ms",
    "User {user_id} authenticated successfully",
    "Cache hit for key: session:{user_id}",
    "Database query executed in {duration}ms",
    "Background job completed: email_notifications",
    "Health check passed - all services healthy",
    "Connection pool stats: active=12, idle=8, total=20",
    "Rate limiter: 45/120 requests used for IP {ip}",
    "CDN cache refreshed for /static/assets",
    "Metrics exported: cpu=23%, memory=45%, disk=67%",
]

WARN_MESSAGES = [
    "Slow query detected: {endpoint} took {duration}ms (threshold: 500ms)",
    "Rate limit approaching for API key: logai-{key_suffix}",
    "Connection pool nearing capacity: 18/20 active connections",
    "Deprecated API version v1 called from {ip}",
    "SSL certificate expires in 14 days",
    "Disk usage at 85% on /var/log",
    "Memory usage at 78% - consider scaling",
    "Retry attempt 2/3 for external payment API",
]

ERROR_MESSAGES = [
    "Database connection refused: Connection timed out after {duration}ms",
    "500 Internal Server Error on {endpoint}: NullPointerException",
    "Failed to process payment: Gateway timeout",
    "Unhandled exception in {service}: TypeError: Cannot read properties of undefined",
    "Redis connection lost - reconnecting",
    "Authentication failed: Invalid token for user {user_id}",
    "Elasticsearch query failed: index_not_found_exception",
    "File upload failed: Maximum size exceeded (52MB > 50MB limit)",
]

CRITICAL_MESSAGES = [
    "FATAL: Out of memory - process killed by OOM killer",
    "Database connection pool exhausted - all connections in use",
    "Cascading failure detected: 3 services unreachable",
    "CRITICAL: Data corruption detected in orders table",
    "Security alert: Brute force attack detected from {ip}",
]


def random_ip():
    return f"{random.randint(10, 192)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def random_user_id():
    return f"usr_{random.randint(10000, 99999)}"


def generate_log(spike_mode=False):
    """Generate a realistic log entry."""
    if spike_mode:
        roll = random.random()
        if roll < 0.7:
            level, messages = "error", ERROR_MESSAGES
        elif roll < 0.9:
            level, messages = "critical", CRITICAL_MESSAGES
        else:
            level, messages = "warn", WARN_MESSAGES
    else:
        roll = random.random()
        if roll < 0.60:
            level, messages = "info", INFO_MESSAGES
        elif roll < 0.78:
            level, messages = "warn", WARN_MESSAGES
        elif roll < 0.95:
            level, messages = "error", ERROR_MESSAGES
        else:
            level, messages = "critical", CRITICAL_MESSAGES

    message = random.choice(messages).format(
        endpoint=random.choice(ENDPOINTS),
        duration=random.randint(5, 8000),
        user_id=random_user_id(),
        ip=random_ip(),
        service=random.choice(SERVICES),
        key_suffix=f"{random.randint(1000, 9999)}",
    )

    service = random.choice(SERVICES)
    host = random.choice(HOSTS)
    environment = random.choice(ENVIRONMENTS)

    meta = {
        "request_id": f"req-{random.randint(100000, 999999)}",
        "status_code": random.choice([200, 201, 204, 301, 400, 401, 403, 404, 500, 502, 503])
        if level in ("error", "critical")
        else random.choice([200, 201, 204]),
    }

    if level in ("error", "critical"):
        meta["duration_ms"] = random.randint(1000, 10000)
    else:
        meta["duration_ms"] = random.randint(5, 500)

    return level, message, service, host, environment, meta


def main():
    parser = argparse.ArgumentParser(description="LogAI Shipper Demo")
    parser.add_argument("--key", required=True, help="API key from server creation")
    parser.add_argument("--server", default="http://localhost:8000", help="LogAI backend URL")
    parser.add_argument("--interval", type=float, default=0.5, help="Seconds between logs")
    parser.add_argument("--source", default="demo-app", help="Source identifier")
    parser.add_argument("--count", type=int, default=0, help="Number of logs, 0 means infinite")
    args = parser.parse_args()

    print("================================================")
    print("       LogAI Demo Shipper")
    print("------------------------------------------------")
    print(f"  Server:   {args.server}")
    print(f"  Source:   {args.source}")
    print(f"  Interval: {args.interval}")
    print("================================================")
    print()

    with LogAIShipper(
        api_key=args.key,
        server_url=args.server,
        source=args.source,
        batch_size=50,
        flush_interval=1.0,
    ) as shipper:
        count = 0
        spike_counter = 0

        try:
            while True:
                spike_mode = spike_counter > 0
                if spike_counter > 0:
                    spike_counter -= 1

                if count > 0 and count % 40 == 0 and not spike_mode:
                    spike_counter = 8
                    print("ERROR SPIKE - injecting burst of errors!")
                    spike_mode = True

                level, message, service, host, environment, meta = generate_log(spike_mode)
                shipper.log(
                    level=level,
                    message=message,
                    service=service,
                    host=host,
                    environment=environment,
                    meta=meta,
                )

                count += 1
                print(f"  [{level.upper():8}] {message[:80]}")

                if args.count > 0 and count >= args.count:
                    print(f"\nSent {count} logs. Done!")
                    break

                time.sleep(args.interval)

        except KeyboardInterrupt:
            print(f"\n\nStopped after {count} logs. Flushing remaining...")


if __name__ == "__main__":
    main()
