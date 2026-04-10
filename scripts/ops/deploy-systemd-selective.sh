#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/root/loomapos}"
BRANCH="${2:-main}"

cd "$REPO_DIR"

OLD_HEAD="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW_HEAD="$(git rev-parse HEAD)"

if [[ "$OLD_HEAD" == "$NEW_HEAD" ]]; then
  echo "No new commits. Nothing to deploy."
  exit 0
fi

CHANGED_FILES="$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD")"
echo "Changed files:"
echo "$CHANGED_FILES"

API_CHANGED=false
WEB_CHANGED=false
OPS_CHANGED=false
NODE_DEPS_CHANGED=false

if echo "$CHANGED_FILES" | grep -qE '^apps/api/'; then
  API_CHANGED=true
fi

if echo "$CHANGED_FILES" | grep -qE '^apps/web-admin/'; then
  WEB_CHANGED=true
fi

if echo "$CHANGED_FILES" | grep -qE '^apps/control-center/'; then
  OPS_CHANGED=true
fi

if echo "$CHANGED_FILES" | grep -qE '^(pnpm-lock\.yaml|pnpm-workspace\.yaml|package\.json|apps/web-admin/package\.json|apps/control-center/package\.json)$'; then
  NODE_DEPS_CHANGED=true
fi

restart_service() {
  local service_name="$1"
  if systemctl restart "$service_name"; then
    :
  else
    sudo systemctl restart "$service_name"
  fi

  if systemctl is-active --quiet "$service_name"; then
    :
  else
    sudo systemctl is-active --quiet "$service_name"
  fi

  echo "$service_name restarted successfully."
}

if [[ "$API_CHANGED" == "true" ]]; then
  echo "Deploying API..."
  dotnet publish apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj -c Release
  restart_service loomapos-api
fi

if [[ "$WEB_CHANGED" == "true" || "$OPS_CHANGED" == "true" ]]; then
  if [[ "$NODE_DEPS_CHANGED" == "true" ]]; then
    echo "Node dependency changes detected. Installing with frozen lockfile..."
    pnpm install --frozen-lockfile
  fi
fi

if [[ "$WEB_CHANGED" == "true" ]]; then
  echo "Deploying web..."
  pnpm --filter @loomapos/web-admin build
  restart_service loomapos-web
fi

if [[ "$OPS_CHANGED" == "true" ]]; then
  echo "Deploying ops..."
  pnpm --filter @loomapos/control-center build
  restart_service loomapos-ops
fi

if [[ "$API_CHANGED" == "false" && "$WEB_CHANGED" == "false" && "$OPS_CHANGED" == "false" ]]; then
  echo "No deployable app changes detected. Skipping service restarts."
fi
