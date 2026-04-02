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

function createTempDbPath(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    tempDir,
    dbPath: path.join(tempDir, "local.db")
  };
}

function withDatabase(testFn) {
  const { tempDir, dbPath } = createTempDbPath("loomapos-sync-hardening-");
  try {
    initializeLocalDatabase(dbPath);
    testFn(dbPath);
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function seedOutboxEvent(eventId, aggregateId = "sale-1") {
  appendOutboxEvent({
    eventId,
    tenantId,
    branchId,
    deviceId,
    eventType: "SALE_CREATED",
    aggregateType: "sale",
    aggregateId,
    payload: { saleId: aggregateId },
    createdAt: new Date(Date.now() - 10 * 60_000).toISOString()
  });
}

function setStaleLastTry(eventId, minutesAgo = 10) {
  const db = getDatabase();
  db.prepare("UPDATE outbox_events SET last_try_at = @lastTryAt WHERE event_id = @eventId").run({
    eventId,
    lastTryAt: new Date(Date.now() - minutesAgo * 60_000).toISOString()
  });
}

function testRecoverStaleSendingToFailed() {
  withDatabase(() => {
    const eventId = "evt-recover-failed";
    seedOutboxEvent(eventId, "sale-1");

    markAsSending([eventId]);
    setStaleLastTry(eventId, 10);

    const recovery = recoverStaleSendingEvents({
      staleThresholdMs: 60_000,
      maxRetryCount: 8,
      baseRetryDelayMs: 3_000,
      maxRetryDelayMs: 300_000
    });

    assert.equal(recovery.recoveredToFailed, 1);
    assert.equal(recovery.movedToDeadLetter, 0);

    const db = getDatabase();
    const row = db.prepare("SELECT status, retry_count AS retryCount, next_retry_at AS nextRetryAt FROM outbox_events WHERE event_id = @eventId")
      .get({ eventId });
    assert.equal(row.status, "FAILED");
    assert.equal(row.retryCount, 1);
    assert.ok(row.nextRetryAt);
  });
}

function testRecoverStaleSendingToDeadLetter() {
  withDatabase(() => {
    const eventId = "evt-recover-dead-letter";
    seedOutboxEvent(eventId, "sale-2");

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
    seedOutboxEvent(eventId, "sale-3");

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

function testRepeatedStaleSendingRecoveryCrashRestartLoop() {
  withDatabase(() => {
    const eventId = "evt-restart-loop";
    seedOutboxEvent(eventId, "sale-loop");

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      markAsSending([eventId]);
      setStaleLastTry(eventId, 10);

      const recovery = recoverStaleSendingEvents({
        staleThresholdMs: 60_000,
        maxRetryCount: 4,
        baseRetryDelayMs: 100,
        maxRetryDelayMs: 10_000
      });

      const db = getDatabase();
      const row = db.prepare("SELECT status, retry_count AS retryCount FROM outbox_events WHERE event_id = @eventId")
        .get({ eventId });

      if (attempt < 4) {
        assert.equal(recovery.recoveredToFailed, 1);
        assert.equal(row.status, "FAILED");
        assert.equal(row.retryCount, attempt);
      } else {
        assert.equal(recovery.movedToDeadLetter, 1);
        assert.equal(row.status, "DEAD_LETTER");
        assert.equal(row.retryCount, 4);
      }

      const count = db.prepare("SELECT COUNT(1) AS count FROM outbox_events WHERE event_id = @eventId")
        .get({ eventId });
      assert.equal(count.count, 1, "event must remain single row across restart loops");
    }
  });
}

function testDuplicateEventAcrossRestartsIsBlocked() {
  const { tempDir, dbPath } = createTempDbPath("loomapos-sync-restart-");
  try {
    initializeLocalDatabase(dbPath);
    seedOutboxEvent("evt-restart-dup", "sale-restart-dup");
    closeLocalDatabase();

    initializeLocalDatabase(dbPath);
    assert.throws(
      () => seedOutboxEvent("evt-restart-dup", "sale-restart-dup"),
      /UNIQUE|unique/i
    );

    const db = getDatabase();
    const row = db.prepare("SELECT COUNT(1) AS count FROM outbox_events WHERE event_id = @eventId")
      .get({ eventId: "evt-restart-dup" });
    assert.equal(row.count, 1);
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testStaleSendingRecoveryAcrossRestartKeepsEventRecoverable() {
  const { tempDir, dbPath } = createTempDbPath("loomapos-sync-stale-restart-");
  try {
    initializeLocalDatabase(dbPath);
    seedOutboxEvent("evt-stale-restart", "sale-stale");
    markAsSending(["evt-stale-restart"]);
    setStaleLastTry("evt-stale-restart", 10);

    closeLocalDatabase();
    initializeLocalDatabase(dbPath);

    const recovery = recoverStaleSendingEvents({
      staleThresholdMs: 60_000,
      maxRetryCount: 8,
      baseRetryDelayMs: 300,
      maxRetryDelayMs: 5_000
    });

    assert.equal(recovery.recoveredToFailed, 1);
    assert.equal(recovery.movedToDeadLetter, 0);

    const db = getDatabase();
    const row = db.prepare("SELECT status, retry_count AS retryCount FROM outbox_events WHERE event_id = @eventId")
      .get({ eventId: "evt-stale-restart" });
    assert.equal(row.status, "FAILED");
    assert.equal(row.retryCount, 1);
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  testRecoverStaleSendingToFailed();
  testRecoverStaleSendingToDeadLetter();
  testFailedVisibilitySummary();
  testRepeatedStaleSendingRecoveryCrashRestartLoop();
  testDuplicateEventAcrossRestartsIsBlocked();
  testStaleSendingRecoveryAcrossRestartKeepsEventRecoverable();
  console.log("Desktop sync chaos hardening tests passed.");
} catch (error) {
  console.error("Desktop sync chaos hardening tests failed.");
  throw error;
}
