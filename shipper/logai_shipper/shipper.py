"""
LogAI Shipper — Python log shipper for the LogAI platform.

Classes:
  LogAIShipper  — Direct API client with background batching.
  LogAIHandler  — Drop-in logging.Handler adapter for Python's logging module.

Usage:
    # Direct usage
    with LogAIShipper(api_key="logai-xxx", server_url="http://localhost:8000") as shipper:
        shipper.info("User logged in", service="auth-service")
        shipper.error("Database timeout", meta={"query": "SELECT ..."})

    # With Python logging
    import logging
    handler = LogAIHandler(api_key="logai-xxx")
    logging.getLogger().addHandler(handler)
    logging.error("Something went wrong")
"""

import atexit
import json
import logging
import queue
import threading
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class LogAIShipper:
    """
    Send logs to LogAI backend via HTTP with background batching.

    Constructor args:
        api_key:         Server API key (x-api-key header)
        server_url:      LogAI backend URL (default: http://localhost:8000)
        source:          Default source identifier
        batch_size:      Flush after this many logs (default: 100)
        flush_interval:  Flush every N seconds (default: 2.0)
        timeout:         HTTP request timeout in seconds (default: 5.0)

    Methods: log(), debug(), info(), warn(), warning(), error(), critical(), flush(), close()
    Context manager support: with LogAIShipper(...) as shipper: ...
    """

    MAX_QUEUE_SIZE = 50_000

    def __init__(
        self,
        api_key: str,
        server_url: str = "http://localhost:8000",
        source: Optional[str] = None,
        batch_size: int = 100,
        flush_interval: float = 2.0,
        timeout: float = 5.0,
    ):
        self.api_key = api_key
        self.server_url = server_url.rstrip("/")
        self.source = source
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.timeout = timeout

        self._queue: queue.Queue = queue.Queue(maxsize=self.MAX_QUEUE_SIZE)
        self._running = True
        # Background flush thread
        self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._flush_thread.start()

        # Ensure final flush on exit
        atexit.register(self.close)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def log(
        self,
        level: str,
        message: str,
        source: Optional[str] = None,
        host: Optional[str] = None,
        service: Optional[str] = None,
        environment: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        timestamp: Optional[int] = None,
    ):
        """Queue a log entry for batched sending."""
        entry = {
            "level": level,
            "message": message,
            "source": source or self.source,
            "host": host,
            "service": service,
            "environment": environment,
            "meta": meta or {},
            "timestamp": timestamp or int(datetime.now(timezone.utc).timestamp() * 1000),
        }

        try:
            self._queue.put_nowait(entry)
        except queue.Full:
            # Drop silently when full — don't crash the app
            pass

    def debug(self, message: str, **kwargs):
        self.log("debug", message, **kwargs)

    def info(self, message: str, **kwargs):
        self.log("info", message, **kwargs)

    def warn(self, message: str, **kwargs):
        self.log("warn", message, **kwargs)

    def warning(self, message: str, **kwargs):
        self.log("warn", message, **kwargs)

    def error(self, message: str, **kwargs):
        self.log("error", message, **kwargs)

    def critical(self, message: str, **kwargs):
        self.log("critical", message, **kwargs)

    def flush(self):
        """Immediately send all queued logs."""
        batch = []
        while not self._queue.empty() and len(batch) < 1000:
            try:
                batch.append(self._queue.get_nowait())
            except queue.Empty:
                break

        if not batch:
            return

        try:
            payload = json.dumps({"logs": batch}).encode("utf-8")
            request = urllib.request.Request(
                f"{self.server_url}/api/v1/ingest/batch",
                data=payload,
                method="POST",
                headers={
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                },
            )
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                if response.status != 201:
                    body = response.read().decode("utf-8", errors="replace")[:200]
                    print(f"[LogAI Shipper] Batch send failed: {response.status} {body}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            print(f"[LogAI Shipper] Batch send failed: {e.code} {body}")
        except Exception as e:
            print(f"[LogAI Shipper] Send error: {e}")

    def close(self):
        """Stop the background thread and flush remaining logs."""
        self._running = False
        self.flush()

    def _flush_loop(self):
        """Background thread that flushes the queue periodically."""
        while self._running:
            time.sleep(self.flush_interval)
            if self._queue.qsize() >= self.batch_size or not self._queue.empty():
                self.flush()


class LogAIHandler(logging.Handler):
    """
    Drop-in logging.Handler for Python's standard logging module.

    Usage:
        import logging
        handler = LogAIHandler(api_key="logai-xxx", server_url="http://localhost:8000")
        logging.getLogger().addHandler(handler)

    Maps Python log levels to LogAI levels.
    Includes logger name, module, funcName, lineno in meta.
    Includes formatted traceback when exception info is present.
    """

    LEVEL_MAP = {
        logging.DEBUG: "debug",
        logging.INFO: "info",
        logging.WARNING: "warn",
        logging.ERROR: "error",
        logging.CRITICAL: "critical",
    }

    def __init__(
        self,
        api_key: str,
        server_url: str = "http://localhost:8000",
        source: Optional[str] = None,
        **kwargs,
    ):
        super().__init__()
        self._shipper = LogAIShipper(
            api_key=api_key,
            server_url=server_url,
            source=source,
            **kwargs,
        )

    def emit(self, record: logging.LogRecord):
        try:
            level = self.LEVEL_MAP.get(record.levelno, "info")
            message = self.format(record) if self.formatter else record.getMessage()

            meta = {
                "logger": record.name,
                "module": record.module,
                "funcName": record.funcName,
                "lineno": record.lineno,
                "pathname": record.pathname,
            }

            # Include traceback if present
            if record.exc_info and record.exc_info[0]:
                meta["traceback"] = "".join(traceback.format_exception(*record.exc_info))

            self._shipper.log(
                level=level,
                message=message,
                meta=meta,
            )
        except Exception:
            self.handleError(record)

    def close(self):
        self._shipper.close()
        super().close()
