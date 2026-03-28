const assert = require("node:assert/strict");

const { deriveSyncDiagnostics } = require("../dist/main/sync/sync-diagnostics.js");

function baseInput(overrides = {}) {
  return {
    pending: 0,
    failed: 0,
    deadLetter: 0,
    lastSuccessAt: "2026-03-27T10:00:00.000Z",
    lastTryAt: "2026-03-27T10:01:00.000Z",
    lastRunAt: "2026-03-27T10:01:00.000Z",
    ...overrides
  };
}

function testPendingCountIsDerived() {
  const nowMs = Date.parse("2026-03-27T10:01:30.000Z");
  const snapshot = deriveSyncDiagnostics(baseInput({ pending: 7 }), nowMs);
  assert.equal(snapshot.pendingCount, 7);
}

function testFailedCountIncludesDeadLetter() {
  const nowMs = Date.parse("2026-03-27T10:01:30.000Z");
  const snapshot = deriveSyncDiagnostics(baseInput({ failed: 2, deadLetter: 3 }), nowMs);
  assert.equal(snapshot.failedCount, 5);
  assert.equal(snapshot.health, "failed");
}

function testDelayedWhenSyncIsStale() {
  const nowMs = Date.parse("2026-03-27T10:08:00.000Z");
  const snapshot = deriveSyncDiagnostics(baseInput({ pending: 1, lastTryAt: "2026-03-27T10:03:00.000Z" }), nowMs);
  assert.equal(snapshot.health, "delayed");
}

function testLastSyncCanBeNever() {
  const nowMs = Date.parse("2026-03-27T10:01:30.000Z");
  const snapshot = deriveSyncDiagnostics(baseInput({ lastSuccessAt: null }), nowMs);
  assert.equal(snapshot.lastSuccessfulSyncAt, null);
  assert.equal(snapshot.health, "delayed");
}

function testHealthyWhenRecentAndClean() {
  const nowMs = Date.parse("2026-03-27T10:01:30.000Z");
  const snapshot = deriveSyncDiagnostics(baseInput({ pending: 1, lastTryAt: "2026-03-27T10:01:10.000Z" }), nowMs);
  assert.equal(snapshot.health, "healthy");
}

try {
  testPendingCountIsDerived();
  testFailedCountIncludesDeadLetter();
  testDelayedWhenSyncIsStale();
  testLastSyncCanBeNever();
  testHealthyWhenRecentAndClean();
  console.log("Desktop sync diagnostics tests passed.");
} catch (error) {
  console.error("Desktop sync diagnostics tests failed.");
  throw error;
}
