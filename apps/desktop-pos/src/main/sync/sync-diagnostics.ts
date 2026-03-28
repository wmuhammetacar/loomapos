export type SyncHealthState = "healthy" | "delayed" | "failed";

export interface SyncDiagnosticsInput {
  pending: number;
  failed: number;
  deadLetter: number;
  lastSuccessAt: string | null;
  lastTryAt: string | null;
  lastRunAt: string | null;
}

export interface SyncDiagnosticsSnapshot {
  pendingCount: number;
  failedCount: number;
  lastSuccessfulSyncAt: string | null;
  health: SyncHealthState;
}

const RECENT_SYNC_THRESHOLD_MS = 2 * 60 * 1000;
const STALE_PENDING_THRESHOLD_MS = 2 * 60 * 1000;

const toAgeMs = (iso: string | null, nowMs: number): number | null => {
  if (!iso) {
    return null;
  }
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.max(0, nowMs - parsed);
};

export const deriveSyncDiagnostics = (
  input: SyncDiagnosticsInput,
  nowMs = Date.now()
): SyncDiagnosticsSnapshot => {
  const failedCount = Math.max(0, input.failed) + Math.max(0, input.deadLetter);
  const pendingCount = Math.max(0, input.pending);
  const lastSuccessAgeMs = toAgeMs(input.lastSuccessAt, nowMs);
  const pendingReferenceAt = input.lastTryAt ?? input.lastRunAt;
  const pendingAgeMs = toAgeMs(pendingReferenceAt, nowMs);

  let health: SyncHealthState = "healthy";
  if (failedCount > 0) {
    health = "failed";
  } else if (lastSuccessAgeMs === null || lastSuccessAgeMs > RECENT_SYNC_THRESHOLD_MS) {
    health = "delayed";
  } else if (pendingCount > 0 && (pendingAgeMs === null || pendingAgeMs > STALE_PENDING_THRESHOLD_MS)) {
    health = "delayed";
  }

  return {
    pendingCount,
    failedCount,
    lastSuccessfulSyncAt: input.lastSuccessAt,
    health
  };
};
