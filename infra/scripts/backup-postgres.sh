#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/infra/backups/manual}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d_%H%M%S)"
output_file="$BACKUP_DIR/loomapos_${timestamp}.sql.gz"

echo "[backup] writing $output_file"
docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-loomapos}" "${POSTGRES_DB:-loomapos}" | gzip > "$output_file"

echo "[backup] pruning files older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[backup] completed"

