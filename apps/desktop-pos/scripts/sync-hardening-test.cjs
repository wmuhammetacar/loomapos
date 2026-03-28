const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  closeLocalDatabase,
  getDatabase,
  initializeLocalDatabase
} = require("../dist/main/storage/local-db.js");
const {
  appendOutboxEvent,
  getOutboxSummary,
  markAsSending,
  recoverStaleSendingEvents
} = require("../dist/main/sync/outbox-repository.js");

const tenantId = "tenant-sync-test";
const branchId = "branch-sync-test";
const deviceId = "device-sync-test";

function withDatabase(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loomapos-sync-hardening-"));
  try {
    initializeLocalDatabase(path.join(tempDir, "local.db"));
    testFn();
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRecoverStaleSendingToFailed() {
  withDatabase(() => {
    const eventId = "evt-recover-failed";
    appendOutboxEvent({
      eventId,
      tenantId,
      branchId,
      deviceId,
      eventType: "SALE_CREATED",
      aggregateType: "sale",
      aggregateId: "sale-1",
      payload: { saleId: "sale-1" },
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString()
    });

    markAsSending([eventId]);

    const db = getDatabase();
    db.prepare("UPDATE outbox_events SET last_try_at = @lastTryAt WHERE event_id = @eventId").run({
      eventId,
      lastTryAt: new Date(Date.now() - 10 * 60_000).toISOString()
    });

    const recovery = recoverStaleSendingEvents({
      staleThresholdMs: 60_000,
      maxRetryCount: 8,
      baseRetryDelayMs: 3_000,
      maxRetryDelayMs: 300_000
    });

    assert.equal(recovery.recoveredToFailed, 1);
    assert.equal(recovery.movedToDeadLetter, 0);

    const row = db.prepare("SELECT status, retry_count AS retryCount, next_retry_at AS nextRetryAt FROM outbox_events WHERE event_id = @eventId")
      .get({ eventId });
    assert.equal(row.status, "FAILED");
    assert.equal(row.retryCount, 1);
    assert.ok(row.nextRetryAt);

    const failedRow = db.prepare("SELECT event_id AS eventId FROM outbox_events WHERE status = 'FAILED' AND retry_count = 1")
      .get();
    assert.equal(failedRow.eventId, eventId);
  });
}

function testRecoverStaleSendingToDeadLetter() {
  withDatabase(() => {
    const eventId = "evt-recover-dead-letter";
    appendOutboxEvent({
      eventId,
      tenantId,
      branchId,
      deviceId,
      eventType: "SALE_CREATED",
      aggregateType: "sale",
      aggregateId: "sale-2",
      payload: { saleId: "sale-2" },
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString()
    });

    markAsSending([eventId]);

    const db = getDatabase();
    db.prepare("UPDATE outbox_events SET retry_count = 7, last_try_at = @lastTryAt WHERE event_id = @eventId").run({
      eventId,
      lastTryAt: new Date(Date.now() - 10 * 60_000).toISOString()
    });

    const recovery = recoverStaleSendingEvents({
      staleThresholdMs: 60_000,
      maxRetryCount: 8,
      baseRetryDelayMs: 3_000,
      maxRetryDelayMs: 300_000
    });

    assert.equal(recovery.recoveredToFailed, 0);
    assert.equal(recovery.movedToDeadLetter, 1);

    const row = db.prepare("SELECT status, retry_count AS retryCount FROM outbox_events WHERE event_id = @eventId")
      .get({ eventId });
    assert.equal(row.status, "DEAD_LETTER");
    assert.equal(row.retryCount, 8);
  });
}

function testFailedVisibilitySummary() {
  withDatabase(() => {
    const eventId = "evt-failed-summary";
    appendOutboxEvent({
      eventId,
      tenantId,
      branchId,
      deviceId,
      eventType: "SALE_CREATED",
      aggregateType: "sale",
      aggregateId: "sale-3",
      payload: { saleId: "sale-3" },
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString()
    });

    markAsSending([eventId]);

    const db = getDatabase();
    db.prepare("UPDATE outbox_events SET status = 'FAILED', error_code = 'network_error', last_error = 'timeout', error_message = 'request timeout', last_try_at = @lastTryAt, retry_count = 3 WHERE event_id = @eventId")
      .run({ eventId, lastTryAt: new Date(Date.now() - 2 * 60_000).toISOString() });

    const summary = getOutboxSummary();
    assert.equal(summary.failed, 1);
    assert.ok(summary.oldestFailedAt);
    assert.ok(summary.failedReasons.some((reason) => reason.errorCode === "network_error" && reason.count === 1));
  });
}

try {
  testRecoverStaleSendingToFailed();
  testRecoverStaleSendingToDeadLetter();
  testFailedVisibilitySummary();
  console.log("Desktop sync hardening tests passed.");
} catch (error) {
  console.error("Desktop sync hardening tests failed.");
  throw error;
}
