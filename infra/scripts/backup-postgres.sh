#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-loomapos}"
POSTGRES_DB="${POSTGRES_DB:-loomapos}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/infra/backups/manual}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[backup] compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="$BACKUP_DIR/${POSTGRES_DB}-backup-${timestamp}.sql.gz"
checksum_file="${output_file}.sha256"

echo "[backup] compose=$COMPOSE_FILE service=$POSTGRES_SERVICE db=$POSTGRES_DB"
echo "[backup] writing $output_file"
docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$output_file"

if [[ ! -s "$output_file" ]]; then
  echo "[backup] backup artifact is empty: $output_file" >&2
  exit 1
fi

sha256sum "$output_file" > "$checksum_file"
echo "[backup] checksum written $checksum_file"

echo "[backup] pruning files older than $RETENTION_DAYS days in $BACKUP_DIR"
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name "*.sha256" -mtime +"$RETENTION_DAYS" -delete

echo "[backup] completed"
echo "$output_file"
