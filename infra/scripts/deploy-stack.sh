#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-production}"
ALLOW_PLACEHOLDERS="${2:-false}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_ENV_FILE="$ROOT_DIR/infra/environments/.env.runtime"

if [[ "$ALLOW_PLACEHOLDERS" == "true" ]]; then
  pwsh "$ROOT_DIR/scripts/ops/render-runtime-env.ps1" -Environment "$ENVIRONMENT" -OutputPath "infra/environments/.env.runtime" -AllowPlaceholderSecrets
else
  pwsh "$ROOT_DIR/scripts/ops/render-runtime-env.ps1" -Environment "$ENVIRONMENT" -OutputPath "infra/environments/.env.runtime"
fi
trap 'rm -f "$RUNTIME_ENV_FILE"' EXIT

docker compose \
  -f "$ROOT_DIR/infra/docker-compose.yml" \
  -f "$ROOT_DIR/infra/deploy/docker-compose.apps.yml" \
  -f "$ROOT_DIR/infra/deploy/docker-compose.${ENVIRONMENT}.yml" \
  config >/dev/null

docker compose \
  -f "$ROOT_DIR/infra/docker-compose.yml" \
  -f "$ROOT_DIR/infra/deploy/docker-compose.apps.yml" \
  -f "$ROOT_DIR/infra/deploy/docker-compose.${ENVIRONMENT}.yml" \
  up -d --build

echo "Waiting for API health..."
for _ in {1..30}; do
  if curl --silent --fail "http://localhost:${API_PORT:-5000}/health/ready" >/dev/null; then
    echo "API is ready."
    exit 0
  fi
  sleep 5
done

echo "API readiness check timed out." >&2
exit 1
