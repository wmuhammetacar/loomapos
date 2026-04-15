#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${DEPLOY_REPO_DIR:-/root/loomapos}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://api.loomapos.com/health/live}"
HEALTH_RETRIES="${DEPLOY_HEALTH_RETRIES:-30}"
HEALTH_SLEEP_SECONDS="${DEPLOY_HEALTH_SLEEP_SECONDS:-5}"
DEPLOY_MODE="${DEPLOY_MODE:-rolling}"

COMPOSE_FILES=(
  -f "$REPO_DIR/docker-compose.yml"
  -f "$REPO_DIR/infra/deploy/docker-compose.apps.yml"
  -f "$REPO_DIR/infra/deploy/docker-compose.production.yml"
)

compose() {
  docker compose "${COMPOSE_FILES[@]}" "$@"
}

wait_for_health() {
  local i

  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    if curl --silent --show-error --fail "$HEALTH_URL" >/dev/null; then
      echo "Health check passed: $HEALTH_URL"
      return 0
    fi

    echo "Health check pending ($i/$HEALTH_RETRIES): $HEALTH_URL"
    sleep "$HEALTH_SLEEP_SECONDS"
  done

  echo "Health check failed after $HEALTH_RETRIES attempts: $HEALTH_URL" >&2
  return 1
}

full_recreate_deploy() {
  echo "Running full recreate deploy (docker compose down/up --build)."
  compose down
  compose up -d --build
}

rolling_deploy() {
  echo "Running rolling deploy (docker compose up -d --build)."
  compose up -d --build --remove-orphans
}

stop_legacy_systemd_services() {
  local service

  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  for service in loomapos-api loomapos-web loomapos-ops; do
    if systemctl stop "$service" >/dev/null 2>&1; then
      echo "Stopped legacy systemd service: $service"
    fi
  done
}

cd "$REPO_DIR"

PREVIOUS_HEAD="$(git rev-parse HEAD)"

echo "Updating repository from origin/$BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"

echo "Resetting local repository state before pull"
git reset --hard HEAD

git pull --ff-only origin "$BRANCH"

stop_legacy_systemd_services

if [[ "$DEPLOY_MODE" == "full" ]]; then
  full_recreate_deploy
else
  if ! rolling_deploy; then
    echo "Rolling deploy failed, retrying with full recreate deploy."
    full_recreate_deploy
  fi
fi

if wait_for_health; then
  echo "Deployment completed successfully."
  exit 0
fi

echo "Deployment failed health check, rolling back to $PREVIOUS_HEAD" >&2
git reset --hard "$PREVIOUS_HEAD"
full_recreate_deploy
wait_for_health

echo "Rollback deployment completed successfully."
