# Backup / Restore Validation Runbook

This runbook is the operational source of truth for PostgreSQL backup and recovery drills.

## Safety Rules

- Restore **must target a non-live database by default**.
- Never restore to the live source DB without explicit `ALLOW_LIVE_RESTORE=1`.
- Fail fast on any backup artifact, checksum, restore, or verification error.
- Use explicit compose file/service/user inputs in non-standard environments.

## Default Inputs

- Compose file: `infra/docker-compose.yml`
- Postgres service: `postgres`
- Source DB: `loomapos`
- Backup location (default): `infra/backups/manual`
- Backup artifact format: `<db>-backup-<UTC_TIMESTAMP>.sql.gz`
- Checksum format: `<artifact>.sha256`

## 1) Create Backup Artifact

```bash
bash infra/scripts/backup-postgres.sh
```

Optional overrides:

```bash
COMPOSE_FILE=infra/docker-compose.yml \
POSTGRES_SERVICE=postgres \
POSTGRES_USER=loomapos \
POSTGRES_DB=loomapos \
BACKUP_DIR=infra/backups/manual \
BACKUP_RETENTION_DAYS=14 \
bash infra/scripts/backup-postgres.sh
```

## 2) Restore Into Recovery Database (Non-live)

```bash
TARGET_DB=loomapos_restore_drill \
bash infra/scripts/restore-postgres.sh infra/backups/manual/<artifact>.sql.gz
```

The restore script blocks live/system targets by default (`loomapos`, `postgres`, `template0`, `template1`).

## 3) Run Full Restore Drill (Backup + Restore + Verification)

```bash
bash infra/scripts/restore-drill-postgres.sh
```

What this drill verifies:

- backup artifact is created/readable
- restore succeeds into isolated target DB
- EF migration history exists in restored DB
- critical tables are queryable after restore
- critical row counts are printed for investigation
- when the drill itself created the backup, source vs restored counts are compared

Critical tables covered:

- `tenants`, `subscriptions`, `licenses`, `devices`
- `sales`, `stock_moves`, `stock_balances`, `stock_by_warehouse`
- `warehouses`, `warehouse_transfers`, `purchase_orders`
- `customer_accounts`, `customer_account_entries`
- `accounting_export_items`
- `bill_of_materials`, `production_orders`

## 4) Recovery Verification SQL (Manual)

```sql
SELECT count(*) FROM __ef_migrations_history;
SELECT count(*) FROM tenants;
SELECT count(*) FROM subscriptions;
SELECT count(*) FROM licenses;
SELECT count(*) FROM devices;
SELECT count(*) FROM sales;
SELECT count(*) FROM stock_moves;
SELECT count(*) FROM warehouses;
```

## 5) Retention and Operations Notes

- Keep daily + weekly + monthly retention according to environment policy.
- Upload off-host backups via ops pipeline/storage policy.
- Record drill timestamp, artifact path, target DB, and verification output in incident/ops log.
- If drill fails, treat as production blocker until backup/restore path is corrected.
