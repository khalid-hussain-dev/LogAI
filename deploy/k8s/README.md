# LogAI Kubernetes Starter

This folder is a basic Kubernetes scaffold for the current LogAI stack. It is meant to support the mid-year phase by giving the project a clean deployment structure without attempting a full production-grade Kubernetes rollout yet.

## What is included

- `base/namespace.yaml`: dedicated namespace
- `base/configmap.yaml`: non-secret shared environment values
- `base/secret.yaml`: placeholder secret values that should be replaced before use
- `base/dependencies.yaml`: PostgreSQL, Redis, and Elasticsearch
- `base/applications.yaml`: backend, stream worker, auth service, and frontend
- `base/ingress.yaml`: same-origin routing for frontend, API, auth, and WebSocket traffic
- `base/kustomization.yaml`: simple entry point for `kubectl apply -k`

## Before applying

1. Replace placeholder values in `base/secret.yaml`
2. Build and push the images referenced in `base/applications.yaml`
3. Update the ingress host if you are not using `logai.local`

## Suggested image tags

- `logai/backend:latest`
- `logai/auth-service:latest`
- `logai/frontend:latest`

## Apply

```bash
kubectl apply -k deploy/k8s/base
```

## Local validation

```bash
python deploy/k8s/validate_manifests.py
```

## Notes

- This is a starter layout, not a production-hardening pass.
- Persistent storage is intentionally minimal.
- Secrets are placeholders only and should be replaced before deployment.
- The frontend now uses same-origin API paths, so ingress can route `/`, `/api/v1`, `/api/auth`, and `/ws` through one host.
- The validator script checks YAML syntax, required fields, and kustomization resource wiring.

