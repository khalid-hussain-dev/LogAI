# Phase 6 Anomaly Model Flow

This document describes the current anomaly-detection behavior after the Phase 6 upgrade.

## Current scoring path

`LogAI` now uses an `Isolation Forest` model as the primary anomaly scorer.

For every incoming log, the backend does this:

1. Compute the statistical fallback score.
2. Extract numeric features from the log.
3. Add the feature row to a rolling training buffer.
4. Train or retrain the Isolation Forest when enough logs have been seen.
5. Use the model output as the final anomaly score once the model is ready.

The public backend interface is still:

```python
score(server_id, level, message, meta) -> float
```

That means the ingest API, stream worker, alerting flow, analytics, and frontend screens did not need contract changes.

## Fallback behavior

The statistical scorer is still important. It is used when:

- the model is still warming up
- `numpy` or `scikit-learn` is not installed
- model training fails
- model inference fails

This keeps the system usable even before the ML model becomes active.

## Features used by the model

The Isolation Forest currently trains on lightweight log features, including:

- normalized log level
- message length and word count
- multiline depth
- critical, timeout, and failure keyword counts
- HTTP status bucket
- request duration when available
- special-character and digit ratios
- metadata size
- the statistical fallback score

These features are intentionally cheap so the stream worker and direct ingest paths stay responsive.

## Default tuning values

- `ANOMALY_USE_ISOLATION_FOREST=true`
- `ANOMALY_MIN_TRAIN_SAMPLES=100`
- `ANOMALY_RETRAIN_INTERVAL=500`
- `ANOMALY_MAX_TRAIN_BUFFER=4000`
- `ANOMALY_IFOREST_ESTIMATORS=200`
- `ANOMALY_IFOREST_CONTAMINATION=0.05`
- `ANOMALY_IFOREST_RANDOM_STATE=42`

## Demo note

Until about `100` logs have passed through a backend process, the system will mostly behave like the earlier heuristic detector. After that warm-up point, the Isolation Forest becomes the primary scorer for that running process.
