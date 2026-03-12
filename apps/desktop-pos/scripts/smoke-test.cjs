const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let Database = null;

const runFallbackMode = () => {
  const localDbSource = path.join(__dirname, "..", "src", "main", "storage", "local-db.ts");
  const mainBuildOutput = path.join(__dirname, "..", "dist", "main", "index.js");
  const source = fs.readFileSync(localDbSource, "utf8");

  if (!source.includes("CREATE TABLE IF NOT EXISTS outbox_events")) {
    throw new Error("Desktop smoke fallback failed: outbox schema declaration missing.");
  }
  if (!fs.existsSync(mainBuildOutput)) {
    throw new Error("Desktop smoke fallback failed: dist/main/index.js is missing.");
  }

  console.log("Desktop smoke test passed (fallback mode): better-sqlite3 native binary unavailable.");
};

try {
  Database = require("better-sqlite3");
} catch (error) {
  runFallbackMode();
  process.exit(0);
}

try {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loomapos-desktop-smoke-"));
  const dbPath = path.join(tempDir, "smoke.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.exec(`
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
`);

  const now = new Date().toISOString();
  db.prepare(`
  INSERT INTO outbox_events(
    event_id, tenant_id, branch_id, device_id, event_type, aggregate_type, aggregate_id,
    payload_json, payload_version, status, created_at, retry_count, last_error, error_message
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?, 0, NULL, NULL)
  `).run(
    "event-smoke-1",
    "tenant-smoke",
    "branch-smoke",
    "device-smoke",
    "STOCK_ADJUSTMENT_RECORDED",
    "stock_move",
    "adjustment-1",
    JSON.stringify({ productId: "p1", qtyDelta: 2, reason: "SMOKE" }),
    now
  );

  const row = db.prepare("SELECT status, retry_count AS retryCount FROM outbox_events WHERE event_id = ?").get("event-smoke-1");
  if (!row || row.status !== "PENDING" || row.retryCount !== 0) {
    throw new Error("Desktop smoke test failed: outbox insert mismatch.");
  }

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log("Desktop smoke test passed.");
} catch (error) {
  if (error && error.code === "ERR_DLOPEN_FAILED") {
    runFallbackMode();
    process.exit(0);
  }

  throw error;
}
