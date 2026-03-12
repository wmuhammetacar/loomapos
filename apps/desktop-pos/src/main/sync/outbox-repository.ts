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

export interface OutboxSummary {
  pending: number;
  failed: number;
  sent: number;
  deadLetter: number;
  lastError: string | null;
  lastTryAt: string | null;
  lastAckAt: string | null;
}

const toPayloadJson = (payload: unknown) => (typeof payload === "string" ? payload : JSON.stringify(payload));

const buildChecksum = (payloadJson: string) =>
  crypto.createHash("sha256").update(payloadJson).digest("hex");

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

  return {
    pending,
    failed,
    sent,
    deadLetter,
    lastError: lastAttempt?.lastError ?? null,
    lastTryAt: lastAttempt?.lastTryAt ?? null,
    lastAckAt: lastAttempt?.lastAckAt ?? null
  };
};
