import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let database: Database.Database | null = null;

export const initializeLocalDatabase = (dbPath: string) => {
  if (database) {
    database.close();
    database = null;
  }
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  database = new Database(dbPath);

  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_session (
      session_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      company_name TEXT,
      portal_type TEXT NOT NULL,
      roles_json TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      refresh_expires_at TEXT NOT NULL,
      last_validated_at TEXT NOT NULL,
      offline_allowed_until TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_activation (
      activation_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_name TEXT,
      branch_id TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      license_id TEXT,
      license_key TEXT,
      license_token TEXT,
      plan_code TEXT,
      feature_flags_json TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      expires_at TEXT,
      grace_days INTEGER NOT NULL DEFAULT 7,
      last_validation_at TEXT NOT NULL,
      offline_allowed_until TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_users (
      user_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      company_name TEXT,
      portal_type TEXT NOT NULL,
      roles_json TEXT NOT NULL,
      status TEXT NOT NULL,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_cashier_profiles (
      cashier_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      operational_role TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      source_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_cashier_profiles_tenant_updated
    ON local_cashier_profiles(tenant_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS local_branches (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_code TEXT,
      branch_name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      unit TEXT NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      stock_tracked INTEGER NOT NULL DEFAULT 1,
      service_item INTEGER NOT NULL DEFAULT 0,
      variant_enabled INTEGER NOT NULL DEFAULT 0,
      negative_stock_allowed INTEGER NOT NULL DEFAULT 0,
      sell_when_out_of_stock INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'seed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_products_search ON local_products(tenant_id, name, sku, barcode);

    CREATE TABLE IF NOT EXISTS local_product_barcodes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      is_primary INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_product_barcodes_product ON local_product_barcodes(product_id);

    CREATE TABLE IF NOT EXISTS local_product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      attributes_json TEXT NOT NULL DEFAULT '{}',
      price_delta REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_cart_drafts (
      draft_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cashier_user_id TEXT,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_sales (
      local_sale_id TEXT PRIMARY KEY,
      cloud_sale_id TEXT,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cashier_user_id TEXT,
      cash_session_id TEXT,
      customer_name TEXT,
      original_sale_id TEXT,
      receipt_no_local TEXT NOT NULL,
      status TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_total REAL NOT NULL,
      tax_total REAL NOT NULL,
      grand_total REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_sales_tenant_created ON local_sales(tenant_id, created_at);

    CREATE TABLE IF NOT EXISTS local_sale_lines (
      local_sale_line_id TEXT PRIMARY KEY,
      local_sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      barcode_snapshot TEXT,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount_amount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      line_total REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_sale_lines_sale ON local_sale_lines(local_sale_id);

    CREATE TABLE IF NOT EXISTS local_payments (
      local_payment_id TEXT PRIMARY KEY,
      local_sale_id TEXT NOT NULL,
      cash_session_id TEXT,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_payments_sale ON local_payments(local_sale_id);

    CREATE TABLE IF NOT EXISTS local_receipts (
      local_receipt_id TEXT PRIMARY KEY,
      local_sale_id TEXT NOT NULL,
      receipt_no_local TEXT NOT NULL,
      template_type TEXT NOT NULL,
      original_receipt_no TEXT,
      receipt_payload_json TEXT NOT NULL,
      print_status TEXT NOT NULL DEFAULT 'pending',
      printed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_receipts_sale ON local_receipts(local_sale_id);

    CREATE TABLE IF NOT EXISTS local_refunds (
      local_refund_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cash_session_id TEXT,
      original_local_sale_id TEXT,
      original_cloud_sale_id TEXT,
      refund_receipt_no TEXT NOT NULL,
      refund_total REAL NOT NULL,
      refund_payment_method TEXT NOT NULL,
      return_to_stock INTEGER NOT NULL DEFAULT 1,
      refund_reason_code TEXT,
      cashier_user_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_refunds_sale ON local_refunds(original_local_sale_id, created_at);

    CREATE TABLE IF NOT EXISTS local_refund_lines (
      local_refund_line_id TEXT PRIMARY KEY,
      local_refund_id TEXT NOT NULL,
      original_line_ref TEXT,
      product_id TEXT NOT NULL,
      qty_refunded REAL NOT NULL,
      refund_amount REAL NOT NULL,
      stock_return_qty REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_refund_lines_refund ON local_refund_lines(local_refund_id);

    CREATE TABLE IF NOT EXISTS local_stock_moves (
      local_stock_move_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      qty_delta REAL NOT NULL,
      reason_code TEXT NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_stock_moves_product ON local_stock_moves(branch_id, product_id, created_at);

    CREATE TABLE IF NOT EXISTS local_stock_snapshot (
      snapshot_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      qty_on_hand REAL NOT NULL DEFAULT 0,
      source_sync_at TEXT,
      last_calculated_at TEXT NOT NULL,
      stale_at TEXT,
      UNIQUE(branch_id, product_id, variant_id)
    );
    CREATE INDEX IF NOT EXISTS ix_local_stock_snapshot_product ON local_stock_snapshot(branch_id, product_id);

    CREATE TABLE IF NOT EXISTS local_cash_sessions (
      cash_session_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cashier_user_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      opening_cash_amount REAL NOT NULL,
      closed_at TEXT,
      closing_cash_expected REAL,
      closing_cash_counted REAL,
      discrepancy_amount REAL,
      status TEXT NOT NULL,
      last_report_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_cash_sessions_status ON local_cash_sessions(branch_id, device_id, status, opened_at);

    CREATE TABLE IF NOT EXISTS local_cash_adjustments (
      local_cash_adjustment_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cash_session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_cash_adjustments_session ON local_cash_adjustments(cash_session_id, created_at);

    CREATE TABLE IF NOT EXISTS local_user_sessions (
      local_user_session_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT,
      device_id TEXT,
      actor_email TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      sync_scope TEXT PRIMARY KEY,
      pending_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      dead_letter_count INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      last_success_at TEXT,
      last_pull_at TEXT,
      last_heartbeat_at TEXT,
      connection_quality TEXT,
      blocked_reason TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_audit_logs (
      audit_log_id TEXT PRIMARY KEY,
      tenant_id TEXT,
      branch_id TEXT,
      device_id TEXT,
      actor_user_id TEXT,
      actor_email TEXT,
      actor_name TEXT,
      action_type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      metadata_json TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_local_audit_logs_created ON local_audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      unit TEXT NOT NULL,
      tax_rate REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_products_search ON products(name, sku, barcode);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cashier_user_id TEXT,
      receipt_no TEXT NOT NULL,
      status TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'TRY',
      sync_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sale_lines (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL NOT NULL,
      tax REAL NOT NULL,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      method TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty_delta REAL NOT NULL,
      reason TEXT NOT NULL,
      ref_type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbox_events (
      event_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      aggregate_type TEXT,
      aggregate_id TEXT,
      payload_json TEXT NOT NULL,
      payload_version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      next_retry_at TEXT,
      last_try_at TEXT,
      server_ack_at TEXT,
      server_reference_id TEXT,
      checksum TEXT,
      error_code TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS ix_outbox_status_created
    ON outbox_events(status, created_at);

    CREATE TABLE IF NOT EXISTS fiscal_jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      receipt_no TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_try_at TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      fiscal_reference TEXT
    );

    CREATE INDEX IF NOT EXISTS ix_fiscal_jobs_status_created
    ON fiscal_jobs(status, created_at);

    CREATE TABLE IF NOT EXISTS z_reports (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      opening_cash REAL NOT NULL,
      cash_sales REAL NOT NULL,
      card_sales REAL NOT NULL,
      refund_total REAL NOT NULL,
      cash_refund REAL NOT NULL,
      card_refund REAL NOT NULL,
      expected_cash REAL NOT NULL,
      counted_cash REAL NOT NULL,
      difference REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ix_z_reports_tenant_date
    ON z_reports(tenant_id, report_date, created_at);
  `);

  ensureColumn("outbox_events", "last_error", "TEXT");
  ensureColumn("outbox_events", "aggregate_type", "TEXT");
  ensureColumn("outbox_events", "aggregate_id", "TEXT");
  ensureColumn("outbox_events", "payload_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("outbox_events", "next_retry_at", "TEXT");
  ensureColumn("outbox_events", "server_ack_at", "TEXT");
  ensureColumn("outbox_events", "server_reference_id", "TEXT");
  ensureColumn("outbox_events", "checksum", "TEXT");
  ensureColumn("outbox_events", "error_code", "TEXT");
  ensureColumn("outbox_events", "error_message", "TEXT");
  ensureColumn("fiscal_jobs", "last_error", "TEXT");
  ensureColumn("fiscal_jobs", "fiscal_reference", "TEXT");
  ensureColumn("sales", "cashier_user_id", "TEXT");
  ensureColumn("sales", "currency", "TEXT NOT NULL DEFAULT 'TRY'");
  ensureColumn("sales", "sync_status", "TEXT NOT NULL DEFAULT 'PENDING'");
  ensureColumn("local_products", "stock_tracked", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("local_products", "service_item", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("local_products", "variant_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("local_products", "negative_stock_allowed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("local_products", "sell_when_out_of_stock", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn("local_sales", "cash_session_id", "TEXT");
  ensureColumn("local_sales", "customer_name", "TEXT");
  ensureColumn("local_sales", "original_sale_id", "TEXT");
  ensureColumn("local_payments", "cash_session_id", "TEXT");
  ensureColumn("local_receipts", "original_receipt_no", "TEXT");
  ensureColumn("sync_state", "dead_letter_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("sync_state", "last_pull_at", "TEXT");
  ensureColumn("sync_state", "last_heartbeat_at", "TEXT");
  ensureColumn("sync_state", "connection_quality", "TEXT");
  ensureColumn("sync_state", "blocked_reason", "TEXT");
  ensureColumn("local_audit_logs", "actor_user_id", "TEXT");
  ensureColumn("local_audit_logs", "action_type", "TEXT");
  ensureColumn("local_audit_logs", "entity_type", "TEXT");
  ensureColumn("local_audit_logs", "entity_id", "TEXT");
  ensureColumn("local_audit_logs", "metadata_json", "TEXT");
  ensureColumn("local_audit_logs", "sync_status", "TEXT NOT NULL DEFAULT 'PENDING'");
};

export const closeLocalDatabase = () => {
  if (!database) {
    return;
  }

  database.close();
  database = null;
};

export const getDatabase = (): Database.Database => {
  if (!database) {
    throw new Error("Local database is not initialized.");
  }

  return database;
};

const ensureColumn = (table: string, columnName: string, typeDefinition: string) => {
  const db = getDatabase();
  const columns = db.prepare(`PRAGMA table_info(${table});`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${typeDefinition};`);
};
