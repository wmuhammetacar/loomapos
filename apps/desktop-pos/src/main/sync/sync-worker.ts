import { getLicenseRuntimeStatus, setLicenseRuntimeStatus } from "../license/license-client.js";
import { getCommerceApiBase } from "../backend/commerce-client.js";
import { getFiscalSyncSummary, processPendingFiscalJobs } from "../fiscal/fiscal-integration.js";
import { getOperationalSessionSummary } from "../operations/operations-service.js";
import { getHardwareDiagnostics } from "../hardware/hardware-service.js";
import { replaceLocalProducts } from "../pos/pos-service.js";
import {
  appendOutboxEvent,
  getDispatchableEvents,
  getOutboxSummary,
  markAsDeadLetter,
  markAsFailed,
  markAsSending,
  markAsSent,
  OutboxEvent,
  resetDeadLetterEvents
} from "./outbox-repository.js";
import {
  getAppSetting,
  getLocalActivation,
  getLocalSession,
  saveSyncState,
  setAppSetting,
  updateLocalSessionRoles,
  upsertLocalBranch
} from "../storage/local-state-repository.js";

const SYNC_INTERVAL_MS = 5000;
const PULL_SYNC_INTERVAL_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 60000;
const BASE_RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRY_COUNT = 8;

export interface SyncStatus {
  isRunning: boolean;
  pending: number;
  failed: number;
  sent: number;
  deadLetter: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastPullAt: string | null;
  lastHeartbeatAt: string | null;
  lastError: string | null;
  lastTryAt: string | null;
  connectionQuality: "online" | "degraded" | "offline";
  blockedReason: string | null;
}

interface SyncAckItem {
  eventId: string;
  status: "accepted" | "duplicate" | "rejected" | "retry_later" | "device_invalid" | "license_invalid";
  alreadyProcessed: boolean;
  message: string;
  errorCode?: string | null;
  serverReferenceId?: string | null;
}

interface SyncPullResponse {
  serverTime: string;
  products: Array<{
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    unit: string;
    taxRate: number;
    price: number;
    isActive: boolean;
    updatedAt?: string | null;
  }>;
  branch?: {
    id: string;
    name: string;
  } | null;
  permissions?: {
    roleCode?: string | null;
  } | null;
  license?: {
    status?: string | null;
    planCode?: string | null;
    expiresAt?: string | null;
    graceDays?: number | null;
    deviceLimit?: number | null;
    activeDevices?: number | null;
    featureFlags?: string[] | null;
  } | null;
}

const syncStatus: SyncStatus = {
  isRunning: false,
  pending: 0,
  failed: 0,
  sent: 0,
  deadLetter: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastPullAt: null,
  lastHeartbeatAt: null,
  lastError: null,
  lastTryAt: null,
  connectionQuality: "online",
  blockedReason: null
};

const pickLatestIso = (left: string | null, right: string | null): string | null => {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
};

const getRetryDelayMs = (retryCount: number) =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, retryCount - 1), MAX_RETRY_DELAY_MS);

const computeNextRetryAt = (retryCount: number) =>
  new Date(Date.now() + getRetryDelayMs(retryCount)).toISOString();

const syncBatchUrl = () => `${getCommerceApiBase()}/sync/events/batch`;
const syncPullUrl = () => `${getCommerceApiBase()}/sync/pull`;

const buildHeaders = (accessToken?: string | null, event?: Pick<OutboxEvent, "tenantId" | "branchId" | "deviceId">) => {
  const headers = new Headers({
    "Content-Type": "application/json"
  });
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (event) {
    headers.set("X-Tenant-Id", event.tenantId);
    headers.set("X-Branch-Id", event.branchId);
    headers.set("X-Device-Id", event.deviceId);
  }
  return headers;
};

const updateSummaryFromDb = () => {
  const outboxSummary = getOutboxSummary();
  const fiscalSummary = getFiscalSyncSummary();

  syncStatus.pending = outboxSummary.pending + fiscalSummary.pending;
  syncStatus.failed = outboxSummary.failed + fiscalSummary.failed;
  syncStatus.sent = outboxSummary.sent + fiscalSummary.sent;
  syncStatus.deadLetter = outboxSummary.deadLetter;
  syncStatus.lastTryAt = pickLatestIso(outboxSummary.lastTryAt, fiscalSummary.lastTryAt);
  syncStatus.lastError = outboxSummary.lastError ?? fiscalSummary.lastError ?? null;

  saveSyncState({
    syncScope: "desktop",
    pendingCount: syncStatus.pending,
    failedCount: syncStatus.failed,
    sentCount: syncStatus.sent,
    deadLetterCount: syncStatus.deadLetter,
    lastRunAt: syncStatus.lastRunAt,
    lastSuccessAt: syncStatus.lastSuccessAt,
    lastPullAt: syncStatus.lastPullAt,
    lastHeartbeatAt: syncStatus.lastHeartbeatAt,
    connectionQuality: syncStatus.connectionQuality,
    blockedReason: syncStatus.blockedReason,
    lastError: syncStatus.lastError
  });
};

const handleAck = (event: OutboxEvent, ack: SyncAckItem) => {
  switch (ack.status) {
    case "accepted":
    case "duplicate":
      markAsSent(event.eventId, ack.serverReferenceId ?? event.aggregateId ?? event.eventId);
      syncStatus.lastSuccessAt = new Date().toISOString();
      syncStatus.lastError = null;
      syncStatus.blockedReason = null;
      return;

    case "device_invalid":
    case "license_invalid": {
      markAsDeadLetter({
        eventId: event.eventId,
        errorCode: ack.errorCode ?? ack.status,
        errorMessage: ack.message
      });
      const current = getLicenseRuntimeStatus();
      setLicenseRuntimeStatus({
        ...current,
        status: "LOCKED",
        message: ack.message,
        lastCheckedAt: new Date().toISOString()
      });
      syncStatus.blockedReason = ack.message;
      return;
    }

    case "rejected":
      markAsDeadLetter({
        eventId: event.eventId,
        errorCode: ack.errorCode ?? "rejected",
        errorMessage: ack.message
      });
      return;

    case "retry_later":
    default:
      markAsFailed({
        eventId: event.eventId,
        errorCode: ack.errorCode ?? "retry_later",
        errorMessage: ack.message,
        nextRetryAt: computeNextRetryAt(event.retryCount + 1)
      });
      return;
  }
};

const markBatchAsFailed = (events: OutboxEvent[], errorMessage: string, errorCode = "network_error") => {
  for (const event of events) {
    const nextRetryCount = event.retryCount + 1;
    if (nextRetryCount >= MAX_RETRY_COUNT) {
      markAsDeadLetter({
        eventId: event.eventId,
        errorCode,
        errorMessage
      });
      continue;
    }

    markAsFailed({
      eventId: event.eventId,
      errorCode,
      errorMessage,
      nextRetryAt: computeNextRetryAt(nextRetryCount)
    });
  }
  syncStatus.connectionQuality = "offline";
  syncStatus.lastError = errorMessage;
};

const pushPendingEvents = async (events: OutboxEvent[], accessToken?: string | null) => {
  if (events.length === 0) {
    return;
  }

  markAsSending(events.map((event) => event.eventId));

  try {
    const response = await fetch(syncBatchUrl(), {
      method: "POST",
      headers: buildHeaders(accessToken, events[0]),
      body: JSON.stringify({
        events: events.map((event) => ({
          eventId: event.eventId,
          tenantId: event.tenantId,
          branchId: event.branchId,
          deviceId: event.deviceId,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payloadVersion: event.payloadVersion,
          payload: JSON.parse(event.payloadJson)
        }))
      })
    });

    if (!response.ok) {
      markBatchAsFailed(events, `Sync API error: ${response.status}`, `http_${response.status}`);
      return;
    }

    const body = (await response.json()) as { results?: SyncAckItem[] };
    const ackById = new Map((body.results ?? []).map((item) => [item.eventId, item]));

    for (const event of events) {
      const ack = ackById.get(event.eventId);
      if (!ack) {
        markAsFailed({
          eventId: event.eventId,
          errorCode: "missing_ack",
          errorMessage: "Server did not acknowledge the event.",
          nextRetryAt: computeNextRetryAt(event.retryCount + 1)
        });
        continue;
      }

      handleAck(event, ack);
    }

    syncStatus.connectionQuality = syncStatus.failed > 0 ? "degraded" : "online";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Desktop sync failed.";
    markBatchAsFailed(events, message);
  }
};

const shouldRunPullSync = () => {
  if (!syncStatus.lastPullAt) {
    return true;
  }

  return Date.now() - new Date(syncStatus.lastPullAt).getTime() >= PULL_SYNC_INTERVAL_MS;
};

const runPullSync = async (accessToken?: string | null) => {
  const activation = getLocalActivation();
  if (!accessToken || !activation || !shouldRunPullSync()) {
    return;
  }

  const since = getAppSetting("sync_last_pull_server_time");
  const url = since ? `${syncPullUrl()}?since=${encodeURIComponent(since)}` : syncPullUrl();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(accessToken, {
        tenantId: activation.tenantId,
        branchId: activation.branchId,
        deviceId: activation.deviceId
      })
    });

    if (!response.ok) {
      syncStatus.connectionQuality = response.status >= 500 ? "degraded" : "offline";
      syncStatus.lastError = `Pull sync failed: ${response.status}`;
      return;
    }

    const payload = (await response.json()) as SyncPullResponse;
    if (payload.products?.length) {
      replaceLocalProducts(
        activation.tenantId,
        payload.products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? null,
          barcode: product.barcode ?? null,
          unit: product.unit,
          taxRate: product.taxRate,
          price: product.price,
          isActive: product.isActive,
          updatedAt: product.updatedAt ?? null
        }))
      );
    }

    if (payload.branch) {
      upsertLocalBranch({
        id: payload.branch.id,
        tenantId: activation.tenantId,
        branchCode: null,
        branchName: payload.branch.name,
        isDefault: true
      });
    }

    if (payload.permissions?.roleCode) {
      updateLocalSessionRoles([payload.permissions.roleCode]);
    }

    if (payload.license) {
      const current = getLicenseRuntimeStatus();
      const mode = (payload.license.status ?? current.status).toUpperCase();
      setLicenseRuntimeStatus({
        ...current,
        status:
          mode === "ACTIVE" || mode === "READ_ONLY" || mode === "LOCKED"
            ? (mode as typeof current.status)
            : current.status,
        planCode: payload.license.planCode ?? current.planCode,
        expiresAt: payload.license.expiresAt ?? current.expiresAt,
        graceDays: payload.license.graceDays ?? current.graceDays,
        maxDevices: payload.license.deviceLimit ?? current.maxDevices,
        activeDevices: payload.license.activeDevices ?? current.activeDevices,
        message: null,
        lastCheckedAt: new Date().toISOString()
      });
    }

    syncStatus.lastPullAt = new Date().toISOString();
    syncStatus.connectionQuality = "online";
    syncStatus.lastError = null;
    setAppSetting("sync_last_pull_server_time", payload.serverTime);
  } catch (error) {
    syncStatus.connectionQuality = "offline";
    syncStatus.lastError = error instanceof Error ? error.message : "Pull sync failed.";
  }
};

const enqueueHeartbeatEvent = () => {
  const activation = getLocalActivation();
  if (!activation) {
    return;
  }

  const lastHeartbeatAt = getAppSetting("sync_last_heartbeat_enqueued_at");
  if (lastHeartbeatAt && Date.now() - new Date(lastHeartbeatAt).getTime() < HEARTBEAT_INTERVAL_MS) {
    return;
  }

  const outbox = getOutboxSummary();
  const hardware = getHardwareDiagnostics();
  const sessionSummary = getOperationalSessionSummary(activation.tenantId, activation.branchId, activation.deviceId);
  appendOutboxEvent({
    tenantId: activation.tenantId,
    branchId: activation.branchId,
    deviceId: activation.deviceId,
    eventType: "DEVICE_HEARTBEAT",
    aggregateType: "device",
    aggregateId: activation.deviceId,
    payload: {
      tenantId: activation.tenantId,
      branchId: activation.branchId,
      deviceId: activation.deviceId,
      appVersion: getAppSetting("desktop_version") ?? "0.1.0",
      localTime: new Date().toISOString(),
      connectionStatus: navigatorLikeOnlineState(),
      pendingOutboxCount: outbox.pending + outbox.failed + outbox.deadLetter,
      activeCashSession: Boolean(sessionSummary.activeSession),
      printerConfigured: hardware.printerConfigured
    }
  });
  syncStatus.lastHeartbeatAt = new Date().toISOString();
  setAppSetting("sync_last_heartbeat_enqueued_at", syncStatus.lastHeartbeatAt);
};

const navigatorLikeOnlineState = () => (syncStatus.connectionQuality === "offline" ? "offline" : "online");

const runSyncLoop = async () => {
  if (syncStatus.isRunning) {
    return;
  }

  syncStatus.isRunning = true;
  syncStatus.lastRunAt = new Date().toISOString();
  setAppSetting("desktop_version", getAppSetting("desktop_version") ?? "0.1.0");

  try {
    enqueueHeartbeatEvent();
    const accessToken = getLocalSession()?.accessToken ?? null;
    const events = getDispatchableEvents(20);
    await pushPendingEvents(events, accessToken);
    await processPendingFiscalJobs();
    await runPullSync(accessToken);
  } finally {
    syncStatus.isRunning = false;
    updateSummaryFromDb();
  }
};

export const startSyncWorker = () => {
  updateSummaryFromDb();
  void runSyncLoop();

  setInterval(() => {
    void runSyncLoop();
  }, SYNC_INTERVAL_MS);
};

export const triggerSyncNow = async () => {
  await runSyncLoop();
};

export const retryDeadLetterSync = async () => {
  resetDeadLetterEvents();
  await runSyncLoop();
};

export const getSyncStatus = (): SyncStatus => {
  updateSummaryFromDb();
  return { ...syncStatus };
};
