#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  infra/scripts/restore-postgres.sh <backup-file>

Environment overrides:
  COMPOSE_FILE         Docker compose file path (default: infra/docker-compose.yml)
  POSTGRES_SERVICE     Compose service name for postgres (default: postgres)
  POSTGRES_USER        Database user (default: loomapos)
  TARGET_DB            Recovery database name (default: loomapos_restore_drill)
  SOURCE_DB            Source/live database name guard (default: POSTGRES_DB or loomapos)
  ALLOW_LIVE_RESTORE   Set to 1 to allow restoring over SOURCE_DB (default: 0)
USAGE
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-loomapos}"
SOURCE_DB="${SOURCE_DB:-${POSTGRES_DB:-loomapos}}"
TARGET_DB="${TARGET_DB:-loomapos_restore_drill}"
ALLOW_LIVE_RESTORE="${ALLOW_LIVE_RESTORE:-0}"
BACKUP_FILE="${1:-${BACKUP_FILE:-}}"

if [[ "$BACKUP_FILE" == "-h" || "$BACKUP_FILE" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$BACKUP_FILE" ]]; then
  echo "[restore] backup file is required." >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[restore] backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[restore] compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! "$TARGET_DB" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "[restore] invalid TARGET_DB '$TARGET_DB'. Allowed pattern: [a-zA-Z0-9_]" >&2
  exit 1
fi

if [[ "$ALLOW_LIVE_RESTORE" != "1" ]]; then
  if [[ "$TARGET_DB" == "$SOURCE_DB" || "$TARGET_DB" == "postgres" || "$TARGET_DB" == "template0" || "$TARGET_DB" == "template1" ]]; then
    echo "[restore] refusing to restore into live/system database '$TARGET_DB'. Set ALLOW_LIVE_RESTORE=1 to override explicitly." >&2
    exit 1
  fi
fi

echo "[restore] compose=$COMPOSE_FILE service=$POSTGRES_SERVICE"
echo "[restore] target_db=$TARGET_DB source_guard=$SOURCE_DB"

docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"

docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"$TARGET_DB\";"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1
else
  cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1
fi

migration_count="$(docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$TARGET_DB" -At -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM __ef_migrations_history;")"

if [[ -z "$migration_count" || "$migration_count" == "0" ]]; then
  echo "[restore] restore sanity check failed: __ef_migrations_history is empty." >&2
  exit 1
fi

echo "[restore] restore completed successfully"
echo "[restore] migration_count=$migration_count"
echo "$TARGET_DB"
