from __future__ import annotations

from pathlib import Path
import sys

import yaml


ROOT = Path(__file__).resolve().parent
BASE_DIR = ROOT / "base"
KUSTOMIZATION_PATH = BASE_DIR / "kustomization.yaml"


def fail(message: str) -> None:
    print(f"[manifest-validation] {message}", file=sys.stderr)
    raise SystemExit(1)


def load_yaml_documents(path: Path) -> list[dict]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            documents = [doc for doc in yaml.safe_load_all(handle) if doc]
    except yaml.YAMLError as exc:
        fail(f"YAML syntax error in {path}: {exc}")
    if not documents:
        fail(f"No YAML documents found in {path}")
    return documents


def validate_kustomization() -> list[Path]:
    documents = load_yaml_documents(KUSTOMIZATION_PATH)
    if len(documents) != 1:
        fail("kustomization.yaml must contain exactly one document")

    doc = documents[0]
    if doc.get("kind") != "Kustomization":
        fail("kustomization.yaml must define kind: Kustomization")

    resources = doc.get("resources") or []
    if not resources:
        fail("kustomization.yaml must list at least one resource")

    resolved_paths: list[Path] = []
    for resource in resources:
        resource_path = BASE_DIR / resource
        if not resource_path.exists():
            fail(f"Referenced resource does not exist: {resource}")
        resolved_paths.append(resource_path)
    return resolved_paths


def validate_document(path: Path, document: dict, index: int) -> None:
    if not isinstance(document, dict):
        fail(f"{path} document #{index} is not a YAML mapping")

    api_version = document.get("apiVersion")
    kind = document.get("kind")
    metadata = document.get("metadata") or {}

    if not api_version:
        fail(f"{path} document #{index} is missing apiVersion")
    if not kind:
        fail(f"{path} document #{index} is missing kind")
    if kind != "Kustomization" and not metadata.get("name"):
        fail(f"{path} document #{index} is missing metadata.name")

    if kind == "Deployment":
        template = ((document.get("spec") or {}).get("template") or {})
        containers = ((template.get("spec") or {}).get("containers") or [])
        if not containers:
            fail(f"{path} deployment {metadata.get('name')} must define at least one container")
        for container in containers:
            if not container.get("image"):
                fail(f"{path} deployment {metadata.get('name')} has a container without an image")

    if kind == "Service":
        ports = ((document.get("spec") or {}).get("ports") or [])
        if not ports:
            fail(f"{path} service {metadata.get('name')} must expose at least one port")

    if kind == "Ingress":
        rules = ((document.get("spec") or {}).get("rules") or [])
        if not rules:
            fail(f"{path} ingress {metadata.get('name')} must define at least one rule")


def main() -> None:
    resource_paths = validate_kustomization()
    validated = 0

    for path in resource_paths:
        for index, document in enumerate(load_yaml_documents(path), start=1):
            validate_document(path, document, index)
            validated += 1

    print(f"[manifest-validation] Validated {validated} Kubernetes resources from {BASE_DIR}")


if __name__ == "__main__":
    main()

