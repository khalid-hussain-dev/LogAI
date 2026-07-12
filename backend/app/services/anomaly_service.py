"""
Anomaly detection service with an Isolation Forest primary path.

Public interface:
    score(server_id, level, message, meta) -> float in [0.0, 1.0]

Model flow:
1. Build a statistical fallback score for every log.
2. Extract numeric features from the same log entry.
3. Train or retrain an Isolation Forest on a rolling feature buffer.
4. Use the model score once it is ready.
5. Fall back to the statistical score during warm-up or if ML deps fail.

The method signature stays stable so ingest routes, workers, and dashboards
do not need to change when the detection internals evolve.
"""

from __future__ import annotations

import logging
import math
import re
from collections import defaultdict, deque
from typing import Any, Deque, Dict, Optional

from app.core.config import settings

try:
    import numpy as np
except ImportError:  # pragma: no cover - optional dependency fallback
    np = None

try:
    from sklearn.ensemble import IsolationForest
except ImportError:  # pragma: no cover - optional dependency fallback
    IsolationForest = None

logger = logging.getLogger(__name__)


class AnomalyService:
    """
    Isolation Forest anomaly scoring service with a statistical fallback.

    Primary scoring path:
    - Isolation Forest once enough feature samples have been collected.

    Fallback scoring path:
    - Level-based heuristics
    - Critical keyword detection
    - HTTP error status detection
    - Short-term error spike detection
    """

    _CRITICAL_PATTERNS = re.compile(
        r"(exception|traceback|crash|oom|out.of.memory|fatal|panic|segfault|"
        r"deadlock|stack.?overflow|heap|null.?pointer|core.?dump|kill|"
        r"unhandled|uncaught|abort|sigkill|sigsegv)",
        re.IGNORECASE,
    )
    _TIMEOUT_PATTERNS = re.compile(r"(timeout|timed.out|deadline|latency)", re.IGNORECASE)
    _FAILURE_PATTERNS = re.compile(
        r"(failed|failure|denied|refused|rollback|unavailable|disconnect)",
        re.IGNORECASE,
    )

    _ERROR_STATUSES = {500, 502, 503, 504, 408, 429}
    _LEVEL_SCORES = {
        "critical": 0.7,
        "error": 0.4,
        "warn": 0.15,
        "warning": 0.15,
        "info": 0.0,
        "debug": 0.0,
    }
    _LEVEL_ENCODINGS = {
        "debug": 0.0,
        "info": 1.0,
        "warn": 2.0,
        "warning": 2.0,
        "error": 3.0,
        "critical": 4.0,
    }

    def __init__(self):
        self._error_counts: Dict[str, list[int]] = defaultdict(list)
        self._window_size = 100

        self._feature_buffer: Deque[list[float]] = deque(
            maxlen=max(200, settings.ANOMALY_MAX_TRAIN_BUFFER)
        )
        self._model: Optional[Any] = None
        self._trained = False
        self._logs_since_train = 0

        self._ml_enabled = bool(
            settings.ANOMALY_USE_ISOLATION_FOREST
            and IsolationForest is not None
            and np is not None
        )

        if settings.ANOMALY_USE_ISOLATION_FOREST and not self._ml_enabled:
            logger.warning(
                "Isolation Forest disabled because numpy/scikit-learn is not available. "
                "Falling back to statistical anomaly scoring."
            )

    def score(
        self,
        server_id: str,
        level: str,
        message: str,
        meta: Dict[str, Any],
    ) -> float:
        """
        Return a float in [0.0, 1.0]. Higher means more anomalous.

        The statistical scorer is always computed first so it can act as:
        - the warm-up score before the ML model is trained
        - the hard fallback if training or inference fails
        - a feature signal for the Isolation Forest itself
        """
        statistical_score = self._statistical_score(level, message, meta, server_id)

        if not self._ml_enabled:
            return statistical_score

        try:
            feature_vector = self._extract_features(
                level=level,
                message=message,
                meta=meta,
                statistical_score=statistical_score,
            )
            self._feature_buffer.append(feature_vector.tolist())
            self._logs_since_train += 1
        except Exception as exc:
            logger.warning(
                "Feature extraction failed for Isolation Forest, using statistical fallback: %s",
                exc,
            )
            return statistical_score

        if self._should_train():
            self._fit_model()

        if not self._trained or self._model is None or np is None:
            return statistical_score

        try:
            raw_score = float(self._model.decision_function(feature_vector.reshape(1, -1))[0])
            return self._normalize_model_score(raw_score)
        except Exception as exc:
            logger.warning(
                "Isolation Forest inference failed, using statistical fallback: %s",
                exc,
            )
            return statistical_score

    def _extract_features(
        self,
        level: str,
        message: str,
        meta: Dict[str, Any],
        statistical_score: float,
    ):
        """Convert a log entry into a numeric feature vector for Isolation Forest."""
        if np is None:
            raise RuntimeError("numpy is not available")

        msg = (message or "").strip()
        msg_lower = msg.lower()
        msg_len = len(msg)
        words = msg.split()

        status_code = self._coerce_int(meta.get("status_code") or meta.get("status"), default=200)
        duration_ms = self._coerce_float(
            meta.get("duration_ms")
            or meta.get("duration")
            or meta.get("response_time_ms")
            or meta.get("latency_ms"),
            default=0.0,
        )

        special_chars = sum(1 for char in msg if not char.isalnum() and not char.isspace())
        digit_chars = sum(1 for char in msg if char.isdigit())

        feature_row = [
            self._LEVEL_ENCODINGS.get((level or "info").lower(), 1.0),
            math.log10(msg_len + 1.0),
            math.log10(len(words) + 1.0),
            math.log10(msg.count("\n") + 1.0),
            min(5.0, float(len(self._CRITICAL_PATTERNS.findall(msg_lower)))),
            min(5.0, float(len(self._TIMEOUT_PATTERNS.findall(msg_lower)))),
            min(5.0, float(len(self._FAILURE_PATTERNS.findall(msg_lower)))),
            min(6.0, max(0.0, status_code / 100.0)),
            math.log10(max(0.0, duration_ms) + 1.0),
            min(1.0, special_chars / max(msg_len, 1)),
            min(1.0, digit_chars / max(msg_len, 1)),
            math.log10(len(meta or {}) + 1.0),
            float(statistical_score),
        ]

        return np.asarray(feature_row, dtype=float)

    def _should_train(self) -> bool:
        """Decide whether the Isolation Forest should train or retrain now."""
        if not self._ml_enabled:
            return False

        if len(self._feature_buffer) < settings.ANOMALY_MIN_TRAIN_SAMPLES:
            return False

        if not self._trained:
            return True

        return self._logs_since_train >= settings.ANOMALY_RETRAIN_INTERVAL

    def _fit_model(self) -> None:
        """Train or retrain the Isolation Forest on the rolling feature buffer."""
        if not self._ml_enabled or np is None or IsolationForest is None:
            return

        previous_model = self._model
        previous_trained = self._trained

        try:
            training_matrix = np.asarray(self._feature_buffer, dtype=float)
            model = IsolationForest(
                n_estimators=max(50, settings.ANOMALY_IFOREST_ESTIMATORS),
                contamination=min(max(settings.ANOMALY_IFOREST_CONTAMINATION, 0.001), 0.5),
                random_state=settings.ANOMALY_IFOREST_RANDOM_STATE,
            )
            model.fit(training_matrix)
            self._model = model
            self._trained = True
            self._logs_since_train = 0
        except Exception as exc:
            self._model = previous_model
            self._trained = previous_trained and previous_model is not None
            logger.warning(
                "Isolation Forest training failed, continuing with statistical fallback: %s",
                exc,
            )

    def _normalize_model_score(self, raw_score: float) -> float:
        """
        Convert Isolation Forest decision_function output to [0.0, 1.0].

        decision_function is usually positive for normal points and negative for anomalies.
        A logistic transform gives us a stable 0..1 score without needing a fixed min/max range.
        """
        scaled = max(-60.0, min(60.0, 8.0 * raw_score))
        score = 1.0 / (1.0 + math.exp(scaled))
        return min(1.0, max(0.0, score))

    def _statistical_score(
        self,
        level: str,
        message: str,
        meta: Dict[str, Any],
        server_id: str = "",
    ) -> float:
        """Statistical anomaly scorer used during model warm-up and failure fallback."""
        score = 0.0
        normalized_level = (level or "info").lower()
        normalized_message = (message or "").lower()

        score += self._LEVEL_SCORES.get(normalized_level, 0.0)

        matches = self._CRITICAL_PATTERNS.findall(normalized_message)
        if matches:
            score += min(0.3, len(matches) * 0.1)

        timeout_matches = self._TIMEOUT_PATTERNS.findall(normalized_message)
        if timeout_matches:
            score += min(0.15, len(timeout_matches) * 0.05)

        failure_matches = self._FAILURE_PATTERNS.findall(normalized_message)
        if failure_matches:
            score += min(0.15, len(failure_matches) * 0.05)

        status_code = meta.get("status_code") or meta.get("status")
        if status_code:
            try:
                if int(status_code) in self._ERROR_STATUSES:
                    score += 0.15
            except (ValueError, TypeError):
                pass

        is_error = normalized_level in ("error", "critical")
        self._error_counts[server_id].append(1 if is_error else 0)

        window = self._error_counts[server_id]
        if len(window) > self._window_size:
            self._error_counts[server_id] = window[-self._window_size:]
            window = self._error_counts[server_id]

        if len(window) >= 20:
            avg = sum(window[:-10]) / max(len(window) - 10, 1)
            recent = sum(window[-10:]) / 10
            if avg > 0 and recent / avg > 2.5:
                score += 0.2

        if len(message or "") > 2000:
            score += 0.05

        return min(1.0, max(0.0, score))

    @staticmethod
    def _coerce_int(value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _coerce_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default
