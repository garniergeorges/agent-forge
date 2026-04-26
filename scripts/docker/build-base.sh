#!/usr/bin/env bash
set -euo pipefail

IMAGE="agent-forge/base:latest"
DOCKERFILE="docker/base.Dockerfile"

echo "Building ${IMAGE} from ${DOCKERFILE}..."
docker build -t "${IMAGE}" -f "${DOCKERFILE}" .
echo
echo "✓ Built ${IMAGE}"
echo "  Try: docker run --rm ${IMAGE} node --version"
