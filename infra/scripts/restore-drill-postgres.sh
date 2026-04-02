#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-loomapos}"
SOURCE_DB="${SOURCE_DB:-${POSTGRES_DB:-loomapos}}"
TARGET_DB="${TARGET_DB:-loomapos_recovery_$(date -u +%Y%m%d%H%M%S)}"
ALLOW_EMPTY_DATA="${ALLOW_EMPTY_DATA:-0}"
BACKUP_FILE="${BACKUP_FILE:-}"

critical_tables=(
  tenants
  subscriptions
  licenses
  devices
  sales
  stock_moves
  stock_balances
  stock_by_warehouse
  warehouses
  warehouse_transfers
  purchase_orders
  customer_accounts
  customer_account_entries
  accounting_export_items
  bill_of_materials
  production_orders
)

query_counts() {
  local db_name="$1"
  local sql=""
  local table
  for table in "${critical_tables[@]}"; do
    if [[ -n "$sql" ]]; then
      sql+=" UNION ALL "
    fi
    sql+="SELECT '${table}' AS table_name, COUNT(*)::bigint AS row_count FROM ${table}"
  done
  sql+=" ORDER BY table_name;"

  docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$db_name" -At -F $'\t' -v ON_ERROR_STOP=1 -c "$sql"
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[drill] compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

generated_backup="0"
if [[ -z "$BACKUP_FILE" ]]; then
  generated_backup="1"
  BACKUP_FILE="$(BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/infra/backups/drill}" COMPOSE_FILE="$COMPOSE_FILE" POSTGRES_SERVICE="$POSTGRES_SERVICE" POSTGRES_USER="$POSTGRES_USER" POSTGRES_DB="$SOURCE_DB" bash "$ROOT_DIR/infra/scripts/backup-postgres.sh" | tail -n1)"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[drill] backup artifact not found: $BACKUP_FILE" >&2
  exit 1
fi

compare_with_source="${COMPARE_WITH_SOURCE:-$generated_backup}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
source_counts_file="$tmp_dir/source-counts.tsv"
recovery_counts_file="$tmp_dir/recovery-counts.tsv"

if [[ "$compare_with_source" == "1" ]]; then
  echo "[drill] collecting source counts from $SOURCE_DB"
  query_counts "$SOURCE_DB" > "$source_counts_file"
fi

echo "[drill] restoring backup into recovery db '$TARGET_DB'"
TARGET_DB="$TARGET_DB" SOURCE_DB="$SOURCE_DB" COMPOSE_FILE="$COMPOSE_FILE" POSTGRES_SERVICE="$POSTGRES_SERVICE" POSTGRES_USER="$POSTGRES_USER" \
  bash "$ROOT_DIR/infra/scripts/restore-postgres.sh" "$BACKUP_FILE" > "$tmp_dir/restore.log"

echo "[drill] collecting recovery counts from $TARGET_DB"
query_counts "$TARGET_DB" > "$recovery_counts_file"

migration_count="$(docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" \
  psql -U "$POSTGRES_USER" -d "$TARGET_DB" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM __ef_migrations_history;")"

if [[ -z "$migration_count" || "$migration_count" == "0" ]]; then
  echo "[drill] migration history check failed on restored DB" >&2
  exit 1
fi

tenants_count="$(awk -F $'\t' '$1=="tenants"{print $2}' "$recovery_counts_file")"
if [[ "$ALLOW_EMPTY_DATA" != "1" && ( -z "$tenants_count" || "$tenants_count" == "0" ) ]]; then
  echo "[drill] tenants table is empty in restored DB; refusing to mark drill successful. Set ALLOW_EMPTY_DATA=1 to override." >&2
  exit 1
fi

if [[ "$compare_with_source" == "1" ]]; then
  if ! diff -u "$source_counts_file" "$recovery_counts_file" > "$tmp_dir/counts.diff"; then
    echo "[drill] source vs restored counts mismatch:" >&2
    cat "$tmp_dir/counts.diff" >&2
    exit 1
  fi
fi

echo "[drill] backup artifact: $BACKUP_FILE"
echo "[drill] restore target db: $TARGET_DB"
echo "[drill] migration_count=$migration_count"
echo "[drill] critical table row counts"
cat "$recovery_counts_file"
echo "[drill] restore drill completed successfully"
