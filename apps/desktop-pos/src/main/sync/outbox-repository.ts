import crypto from "node:crypto";
import { getDatabase } from "../storage/local-db.js";

export type OutboxStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "DEAD_LETTER";

export interface OutboxEvent {
  eventId: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payloadJson: string;
  payloadVersion: number;
  status: OutboxStatus;
  createdAt: string;
  nextRetryAt: string | null;
  lastTryAt: string | null;
  serverAckAt: string | null;
  serverReferenceId: string | null;
  checksum: string | null;
  errorCode: string | null;
  retryCount: number;
  lastError: string | null;
  errorMessage: string | null;
}

export interface AppendOutboxEventInput {
  tenantId: string;
  branchId: string;
  deviceId: string;
  eventType: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payload: unknown;
  payloadVersion?: number;
  eventId?: string;
  createdAt?: string;
}

export interface OutboxFailureReason {
  errorCode: string;
  count: number;
  sampleMessage: string | null;
  latestAt: string | null;
}

export interface OutboxSummary {
  pending: number;
  failed: number;
  sent: number;
  deadLetter: number;
  oldestFailedAt: string | null;
  failedReasons: OutboxFailureReason[];
  lastError: string | null;
  lastTryAt: string | null;
  lastAckAt: string | null;
}

export interface RecoverStaleSendingEventsInput {
  staleThresholdMs: number;
  maxRetryCount: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  nowIso?: string;
}

export interface RecoverStaleSendingEventsResult {
  scanned: number;
  recoveredToFailed: number;
  movedToDeadLetter: number;
  oldestRecoveredAt: string | null;
}

const toPayloadJson = (payload: unknown) => (typeof payload === "string" ? payload : JSON.stringify(payload));

const buildChecksum = (payloadJson: string) =>
  crypto.createHash("sha256").update(payloadJson).digest("hex");

const computeRetryDelayMs = (retryCount: number, baseRetryDelayMs: number, maxRetryDelayMs: number) =>
  Math.min(baseRetryDelayMs * 2 ** Math.max(0, retryCount - 1), maxRetryDelayMs);

const isPastThreshold = (timestamp: string, nowMs: number, staleThresholdMs: number) =>
  nowMs - new Date(timestamp).getTime() >= staleThresholdMs;

export const appendOutboxEvent = (event: AppendOutboxEventInput) => {
  const db = getDatabase();
  const now = event.createdAt ?? new Date().toISOString();
  const payloadJson = toPayloadJson(event.payload);
  db.prepare(`
    INSERT INTO outbox_events(
      event_id,
      tenant_id,
      branch_id,
      device_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload_json,
      payload_version,
      status,
      created_at,
      next_retry_at,
      last_try_at,
      server_ack_at,
      server_reference_id,
      checksum,
      error_code,
      retry_count,
      last_error,
      error_message
    )
    VALUES(
      @eventId,
      @tenantId,
      @branchId,
      @deviceId,
      @eventType,
      @aggregateType,
      @aggregateId,
      @payloadJson,
      @payloadVersion,
      'PENDING',
      @createdAt,
      NULL,
      NULL,
      NULL,
      NULL,
      @checksum,
      NULL,
      0,
      NULL,
      NULL
    )
  `).run({
    eventId: event.eventId ?? crypto.randomUUID(),
    tenantId: event.tenantId,
    branchId: event.branchId,
    deviceId: event.deviceId,
    eventType: event.eventType,
    aggregateType: event.aggregateType ?? null,
    aggregateId: event.aggregateId ?? null,
    payloadJson,
    payloadVersion: event.payloadVersion ?? 1,
    createdAt: now,
    checksum: buildChecksum(payloadJson)
  });
};

export const getDispatchableEvents = (limit = 25): OutboxEvent[] => {
  const db = getDatabase();
  return db
    .prepare(`
      SELECT
        event_id AS eventId,
        tenant_id AS tenantId,
        branch_id AS branchId,
        device_id AS deviceId,
        event_type AS eventType,
        aggregate_type AS aggregateType,
        aggregate_id AS aggregateId,
        payload_json AS payloadJson,
        payload_version AS payloadVersion,
        status,
        created_at AS createdAt,
        next_retry_at AS nextRetryAt,
        last_try_at AS lastTryAt,
        server_ack_at AS serverAckAt,
        server_reference_id AS serverReferenceId,
        checksum,
        error_code AS errorCode,
        retry_count AS retryCount,
        last_error AS lastError,
        error_message AS errorMessage
      FROM outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_retry_at IS NULL OR next_retry_at <= @now)
      ORDER BY created_at ASC
      LIMIT @limit
    `)
    .all({ now: new Date().toISOString(), limit }) as OutboxEvent[];
};

export const markAsSending = (eventIds: string[]) => {
  if (eventIds.length === 0) {
    return;
  }

  const db = getDatabase();
  const mark = db.prepare(`
    UPDATE outbox_events
    SET
      status = 'SENDING',
      last_try_at = @lastTryAt
    WHERE event_id = @eventId
  `);
  const tx = db.transaction((ids: string[]) => {
    const lastTryAt = new Date().toISOString();
    for (const eventId of ids) {
      mark.run({ eventId, lastTryAt });
    }
  });
  tx(eventIds);
};

export const markAsSent = (eventId: string, serverReferenceId?: string | null) => {
  const db = getDatabase();
  db.prepare(`
    UPDATE outbox_events
    SET
      status = 'SENT',
      server_ack_at = @serverAckAt,
      server_reference_id = @serverReferenceId,
      next_retry_at = NULL,
      error_code = NULL,
      last_error = NULL,
      error_message = NULL
    WHERE event_id = @eventId
  `).run({
    eventId,
    serverAckAt: new Date().toISOString(),
    serverReferenceId: serverReferenceId ?? null
  });
};

export const markAsFailed = (input: {
  eventId: string;
  errorCode?: string | null;
  errorMessage: string;
  nextRetryAt: string | null;
}) => {
  const db = getDatabase();
  db.prepare(`
    UPDATE outbox_events
    SET
      status = 'FAILED',
      retry_count = retry_count + 1,
      next_retry_at = @nextRetryAt,
      error_code = @errorCode,
      last_error = @lastError,
      error_message = @errorMessage
    WHERE event_id = @eventId
  `).run({
    eventId: input.eventId,
    nextRetryAt: input.nextRetryAt,
    errorCode: input.errorCode ?? null,
    lastError: input.errorMessage.slice(0, 500),
    errorMessage: input.errorMessage.slice(0, 1000)
  });
};

export const markAsDeadLetter = (input: {
  eventId: string;
  errorCode?: string | null;
  errorMessage: string;
}) => {
  const db = getDatabase();
  db.prepare(`
    UPDATE outbox_events
    SET
      status = 'DEAD_LETTER',
      retry_count = retry_count + 1,
      next_retry_at = NULL,
      error_code = @errorCode,
      last_error = @lastError,
      error_message = @errorMessage
    WHERE event_id = @eventId
  `).run({
    eventId: input.eventId,
    errorCode: input.errorCode ?? null,
    lastError: input.errorMessage.slice(0, 500),
    errorMessage: input.errorMessage.slice(0, 1000)
  });
};

export const resetDeadLetterEvents = (eventIds?: string[]) => {
  const db = getDatabase();
  if (!eventIds || eventIds.length === 0) {
    db.prepare(`
      UPDATE outbox_events
      SET
        status = 'PENDING',
        next_retry_at = NULL,
        error_code = NULL,
        last_error = NULL,
        error_message = NULL
      WHERE status = 'DEAD_LETTER'
    `).run();
    return;
  }

  const stmt = db.prepare(`
    UPDATE outbox_events
    SET
      status = 'PENDING',
      next_retry_at = NULL,
      error_code = NULL,
      last_error = NULL,
      error_message = NULL
    WHERE event_id = @eventId
  `);
  const tx = db.transaction((ids: string[]) => {
    for (const eventId of ids) {
      stmt.run({ eventId });
    }
  });
  tx(eventIds);
};

export const recoverStaleSendingEvents = (
  input: RecoverStaleSendingEventsInput
): RecoverStaleSendingEventsResult => {
  const db = getDatabase();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  const rows = db
    .prepare(`
      SELECT
        event_id AS eventId,
        retry_count AS retryCount,
        created_at AS createdAt,
        last_try_at AS lastTryAt
      FROM outbox_events
      WHERE status = 'SENDING'
    `)
    .all() as Array<{
    eventId: string;
    retryCount: number;
    createdAt: string;
    lastTryAt: string | null;
  }>;

  const markRecoveredAsFailed = db.prepare(`
    UPDATE outbox_events
    SET
      status = 'FAILED',
      retry_count = @retryCount,
      next_retry_at = @nextRetryAt,
      error_code = @errorCode,
      last_error = @lastError,
      error_message = @errorMessage
    WHERE event_id = @eventId
      AND status = 'SENDING'
  `);

  const markRecoveredAsDeadLetter = db.prepare(`
    UPDATE outbox_events
    SET
      status = 'DEAD_LETTER',
      retry_count = @retryCount,
      next_retry_at = NULL,
      error_code = @errorCode,
      last_error = @lastError,
      error_message = @errorMessage
    WHERE event_id = @eventId
      AND status = 'SENDING'
  `);

  let recoveredToFailed = 0;
  let movedToDeadLetter = 0;
  let oldestRecoveredAt: string | null = null;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const referenceAt = row.lastTryAt ?? row.createdAt;
      if (!isPastThreshold(referenceAt, nowMs, input.staleThresholdMs)) {
        continue;
      }

      if (!oldestRecoveredAt || new Date(referenceAt).getTime() < new Date(oldestRecoveredAt).getTime()) {
        oldestRecoveredAt = referenceAt;
      }

      const nextRetryCount = row.retryCount + 1;
      if (nextRetryCount >= input.maxRetryCount) {
        const info = markRecoveredAsDeadLetter.run({
          eventId: row.eventId,
          retryCount: nextRetryCount,
          errorCode: "stale_sending_dead_letter",
          lastError: "Recovered stale SENDING event exceeded retry threshold.",
          errorMessage: `Recovered stale SENDING event after restart and moved to DEAD_LETTER at retry ${nextRetryCount}.`
        });

        if (info.changes > 0) {
          movedToDeadLetter += 1;
        }
        continue;
      }

      const retryDelayMs = computeRetryDelayMs(nextRetryCount, input.baseRetryDelayMs, input.maxRetryDelayMs);
      const info = markRecoveredAsFailed.run({
        eventId: row.eventId,
        retryCount: nextRetryCount,
        nextRetryAt: new Date(nowMs + retryDelayMs).toISOString(),
        errorCode: "stale_sending_recovered",
        lastError: "Recovered stale SENDING event after restart.",
        errorMessage: `Recovered stale SENDING event after restart, scheduled retry #${nextRetryCount}.`
      });
      if (info.changes > 0) {
        recoveredToFailed += 1;
      }
    }
  });

  tx();

  return {
    scanned: rows.length,
    recoveredToFailed,
    movedToDeadLetter,
    oldestRecoveredAt
  };
};

export const getOutboxSummary = (): OutboxSummary => {
  const db = getDatabase();
  const countByStatusRows = db
    .prepare(`
      SELECT status, COUNT(1) AS count
      FROM outbox_events
      GROUP BY status
    `)
    .all() as Array<{ status: OutboxStatus; count: number }>;

  let pending = 0;
  let failed = 0;
  let sent = 0;
  let deadLetter = 0;
  for (const row of countByStatusRows) {
    if (row.status === "PENDING" || row.status === "SENDING") {
      pending += row.count;
      continue;
    }

    if (row.status === "FAILED") {
      failed = row.count;
      continue;
    }

    if (row.status === "DEAD_LETTER") {
      deadLetter = row.count;
      continue;
    }

    if (row.status === "SENT") {
      sent = row.count;
    }
  }

  const lastAttempt = db
    .prepare(`
      SELECT
        last_error AS lastError,
        last_try_at AS lastTryAt,
        server_ack_at AS lastAckAt
      FROM outbox_events
      WHERE last_try_at IS NOT NULL OR server_ack_at IS NOT NULL
      ORDER BY COALESCE(server_ack_at, last_try_at) DESC
      LIMIT 1
    `)
    .get() as { lastError: string | null; lastTryAt: string | null; lastAckAt: string | null } | undefined;

  const oldestFailedRow = db
    .prepare(`
      SELECT MIN(COALESCE(last_try_at, created_at)) AS oldestFailedAt
      FROM outbox_events
      WHERE status IN ('FAILED', 'DEAD_LETTER')
    `)
    .get() as { oldestFailedAt: string | null } | undefined;

  const failedReasons = db
    .prepare(`
      SELECT
        COALESCE(error_code, 'unknown') AS errorCode,
        COUNT(1) AS count,
        MAX(COALESCE(error_message, last_error)) AS sampleMessage,
        MAX(COALESCE(last_try_at, created_at)) AS latestAt
      FROM outbox_events
      WHERE status IN ('FAILED', 'DEAD_LETTER')
      GROUP BY COALESCE(error_code, 'unknown')
      ORDER BY count DESC, latestAt DESC
      LIMIT 5
    `)
    .all() as OutboxFailureReason[];

  return {
    pending,
    failed,
    sent,
    deadLetter,
    oldestFailedAt: oldestFailedRow?.oldestFailedAt ?? null,
    failedReasons,
    lastError: lastAttempt?.lastError ?? null,
    lastTryAt: lastAttempt?.lastTryAt ?? null,
    lastAckAt: lastAttempt?.lastAckAt ?? null
  };
};
