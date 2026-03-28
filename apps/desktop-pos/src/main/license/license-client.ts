import fs from "node:fs";
import path from "node:path";

export interface LicenseRuntimeStatus {
  status: "UNKNOWN" | "ACTIVE" | "READ_ONLY" | "LOCKED" | "ERROR";
  planCode: string | null;
  expiresAt: string | null;
  graceDays: number | null;
  maxDevices: number | null;
  activeDevices: number | null;
  message: string | null;
  lastCheckedAt: string | null;
  lifecycleState: string | null;
  allowedActions: string[];
  blockedActions: string[];
  canCheckout: boolean;
  canWrite: boolean;
  canSync: boolean;
  canView: boolean;
  requiresUpgradeAction: boolean;
  requiresBlock: boolean;
}

interface LicenseContext {
  tenantId: string;
  branchId: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  cacheFilePath?: string;
}

const runtimeStatus: LicenseRuntimeStatus = {
  status: "UNKNOWN",
  planCode: null,
  expiresAt: null,
  graceDays: null,
  maxDevices: null,
  activeDevices: null,
  message: null,
  lastCheckedAt: null,
  lifecycleState: null,
  allowedActions: [],
  blockedActions: [],
  canCheckout: false,
  canWrite: false,
  canSync: false,
  canView: true,
  requiresUpgradeAction: false,
  requiresBlock: false
};

export const setLicenseRuntimeStatus = (next: LicenseRuntimeStatus) => {
  runtimeStatus.status = next.status;
  runtimeStatus.planCode = next.planCode;
  runtimeStatus.expiresAt = next.expiresAt;
  runtimeStatus.graceDays = next.graceDays;
  runtimeStatus.maxDevices = next.maxDevices;
  runtimeStatus.activeDevices = next.activeDevices;
  runtimeStatus.message = next.message;
  runtimeStatus.lastCheckedAt = next.lastCheckedAt;
  runtimeStatus.lifecycleState = next.lifecycleState;
  runtimeStatus.allowedActions = next.allowedActions;
  runtimeStatus.blockedActions = next.blockedActions;
  runtimeStatus.canCheckout = next.canCheckout;
  runtimeStatus.canWrite = next.canWrite;
  runtimeStatus.canSync = next.canSync;
  runtimeStatus.canView = next.canView;
  runtimeStatus.requiresUpgradeAction = next.requiresUpgradeAction;
  runtimeStatus.requiresBlock = next.requiresBlock;
};

interface LicenseCacheSnapshot {
  planCode: string | null;
  mode: "ACTIVE" | "READ_ONLY" | "LOCKED";
  expiresAt: string | null;
  graceDays: number;
  maxDevices: number | null;
  activeDevices: number | null;
  lastSuccessAt: string;
}

const DEFAULT_OFFLINE_GRACE_DAYS = 7;

const getApiBaseUrl = () => {
  const explicit = process.env.LOOMAPOS_API_BASE?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const syncUrl = process.env.LOOMAPOS_API_URL?.trim();
  if (syncUrl) {
    try {
      const parsed = new URL(syncUrl);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // fallback
    }
  }

  return "http://localhost:5000";
};

const buildHeaders = (context: LicenseContext) => ({
  "Content-Type": "application/json",
  "X-Tenant-Id": context.tenantId,
  "X-Branch-Id": context.branchId,
  "X-Device-Id": context.deviceId
});

const applyPayload = (payload: {
  planCode?: string;
  mode?: string;
  expiresAt?: string;
  graceDays?: number;
  maxDevices?: number | null;
  activeDevices?: number;
}) => {
  const mode = payload.mode?.toUpperCase();
  runtimeStatus.status =
    mode === "ACTIVE" || mode === "READ_ONLY" || mode === "LOCKED"
      ? mode
      : runtimeStatus.status === "UNKNOWN"
      ? "ERROR"
      : runtimeStatus.status;
  runtimeStatus.planCode = payload.planCode ?? runtimeStatus.planCode;
  runtimeStatus.expiresAt = payload.expiresAt ?? runtimeStatus.expiresAt;
  runtimeStatus.graceDays = payload.graceDays ?? runtimeStatus.graceDays;
  runtimeStatus.maxDevices = payload.maxDevices ?? runtimeStatus.maxDevices;
  runtimeStatus.activeDevices = payload.activeDevices ?? runtimeStatus.activeDevices;
  runtimeStatus.lastCheckedAt = new Date().toISOString();
  runtimeStatus.message = null;

  if (mode === "READ_ONLY") {
    runtimeStatus.lifecycleState = "trial_expired";
    runtimeStatus.allowedActions = ["Rapor goruntuleme", "Durum izleme"];
    runtimeStatus.blockedActions = ["Satis", "Stok mutasyonu", "Sync push", "Yeni cihaz aktivasyonu"];
    runtimeStatus.canCheckout = false;
    runtimeStatus.canWrite = false;
    runtimeStatus.canSync = false;
    runtimeStatus.canView = true;
    runtimeStatus.requiresUpgradeAction = true;
    runtimeStatus.requiresBlock = false;
    return;
  }

  if (mode === "LOCKED") {
    runtimeStatus.lifecycleState = "suspended_blocked";
    runtimeStatus.allowedActions = ["Rapor goruntuleme", "Durum izleme"];
    runtimeStatus.blockedActions = ["Satis", "Stok mutasyonu", "Sync push", "Cihaz aktivasyonu"];
    runtimeStatus.canCheckout = false;
    runtimeStatus.canWrite = false;
    runtimeStatus.canSync = false;
    runtimeStatus.canView = true;
    runtimeStatus.requiresUpgradeAction = true;
    runtimeStatus.requiresBlock = true;
    return;
  }

  runtimeStatus.lifecycleState = "subscription_active";
  runtimeStatus.allowedActions = ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"];
  runtimeStatus.blockedActions = ["-"];
  runtimeStatus.canCheckout = true;
  runtimeStatus.canWrite = true;
  runtimeStatus.canSync = true;
  runtimeStatus.canView = true;
  runtimeStatus.requiresUpgradeAction = false;
  runtimeStatus.requiresBlock = false;
};

const getCacheFilePath = (context: LicenseContext) =>
  context.cacheFilePath?.trim() || path.join(process.cwd(), ".loomapos-license-cache.json");

const saveCacheSnapshot = (
  context: LicenseContext,
  payload: {
    planCode?: string;
    mode?: string;
    expiresAt?: string;
    graceDays?: number;
    maxDevices?: number | null;
    activeDevices?: number;
  }
) => {
  try {
    const cachePath = getCacheFilePath(context);
    const directory = path.dirname(cachePath);
    fs.mkdirSync(directory, { recursive: true });

    const mode = payload.mode?.toUpperCase();
    const snapshot: LicenseCacheSnapshot = {
      planCode: payload.planCode ?? runtimeStatus.planCode,
      mode: mode === "READ_ONLY" || mode === "LOCKED" ? mode : "ACTIVE",
      expiresAt: payload.expiresAt ?? runtimeStatus.expiresAt,
      graceDays: payload.graceDays ?? runtimeStatus.graceDays ?? DEFAULT_OFFLINE_GRACE_DAYS,
      maxDevices: payload.maxDevices ?? runtimeStatus.maxDevices,
      activeDevices: payload.activeDevices ?? runtimeStatus.activeDevices,
      lastSuccessAt: new Date().toISOString()
    };

    fs.writeFileSync(cachePath, JSON.stringify(snapshot), "utf8");
  } catch {
    // Cache write failure should not block POS.
  }
};

const readCacheSnapshot = (context: LicenseContext): LicenseCacheSnapshot | null => {
  try {
    const payload = fs.readFileSync(getCacheFilePath(context), "utf8");
    const parsed = JSON.parse(payload) as Partial<LicenseCacheSnapshot>;
    if (!parsed || typeof parsed.lastSuccessAt !== "string") {
      return null;
    }

    const mode =
      parsed.mode === "ACTIVE" || parsed.mode === "READ_ONLY" || parsed.mode === "LOCKED" ? parsed.mode : "ACTIVE";

    return {
      planCode: parsed.planCode ?? null,
      mode,
      expiresAt: parsed.expiresAt ?? null,
      graceDays: parsed.graceDays ?? DEFAULT_OFFLINE_GRACE_DAYS,
      maxDevices: parsed.maxDevices ?? null,
      activeDevices: parsed.activeDevices ?? null,
      lastSuccessAt: parsed.lastSuccessAt
    };
  } catch {
    return null;
  }
};

const applyOfflineGraceFallback = (context: LicenseContext, reason: string): boolean => {
  const cached = readCacheSnapshot(context);
  if (!cached) {
    return false;
  }

  const offlineUntil = new Date(cached.lastSuccessAt).getTime() + cached.graceDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  runtimeStatus.planCode = cached.planCode;
  runtimeStatus.expiresAt = cached.expiresAt;
  runtimeStatus.graceDays = cached.graceDays;
  runtimeStatus.maxDevices = cached.maxDevices;
  runtimeStatus.activeDevices = cached.activeDevices;
  runtimeStatus.lastCheckedAt = new Date().toISOString();

  if (now > offlineUntil) {
    runtimeStatus.status = "LOCKED";
    runtimeStatus.message = `Lisans offline grace bitti. Sebep: ${reason}`;
    return true;
  }

  runtimeStatus.status = cached.mode === "LOCKED" ? "LOCKED" : cached.mode;
  runtimeStatus.message = `Sunucuya ulasilamadi. Offline grace ile devam (${new Date(offlineUntil).toISOString()}).`;
  return true;
};

export const activateDeviceLicense = async (context: LicenseContext) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/license/activate`, {
      method: "POST",
      headers: buildHeaders(context),
      body: JSON.stringify({
        deviceId: context.deviceId,
        deviceName: context.deviceName,
        platform: "desktop",
        appVersion: context.appVersion,
        source: "desktop"
      })
    });

    if (response.status === 403) {
      runtimeStatus.status = "LOCKED";
      runtimeStatus.message = "Lisans dogrulamasi basarisiz veya cihaz limiti asildi.";
      runtimeStatus.lastCheckedAt = new Date().toISOString();
      return;
    }

    if (!response.ok) {
      if (!applyOfflineGraceFallback(context, `HTTP ${response.status}`)) {
        runtimeStatus.status = "ERROR";
        runtimeStatus.message = `Lisans aktivasyon hatasi: HTTP ${response.status}`;
        runtimeStatus.lastCheckedAt = new Date().toISOString();
      }
      return;
    }

    const payload = (await response.json()) as {
      planCode?: string;
      mode?: string;
      expiresAt?: string;
      graceDays?: number;
      maxDevices?: number | null;
      activeDevices?: number;
    };
    applyPayload(payload);
    saveCacheSnapshot(context, payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Lisans aktivasyon hatasi.";
    if (!applyOfflineGraceFallback(context, reason)) {
      runtimeStatus.status = "ERROR";
      runtimeStatus.message = reason;
      runtimeStatus.lastCheckedAt = new Date().toISOString();
    }
  }
};

export const refreshLicenseStatus = async (context: LicenseContext) => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/license/status`, {
      method: "GET",
      headers: buildHeaders(context)
    });

    if (response.status === 404) {
      runtimeStatus.status = "LOCKED";
      runtimeStatus.message = "Aktif lisans bulunamadi.";
      runtimeStatus.lastCheckedAt = new Date().toISOString();
      return;
    }

    if (!response.ok) {
      if (!applyOfflineGraceFallback(context, `HTTP ${response.status}`)) {
        runtimeStatus.status = "ERROR";
        runtimeStatus.message = `Lisans durum hatasi: HTTP ${response.status}`;
        runtimeStatus.lastCheckedAt = new Date().toISOString();
      }
      return;
    }

    const payload = (await response.json()) as {
      planCode?: string;
      mode?: string;
      expiresAt?: string;
      graceDays?: number;
      maxDevices?: number | null;
      activeDevices?: number;
    };
    applyPayload(payload);
    saveCacheSnapshot(context, payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Lisans durum sorgusu basarisiz.";
    if (!applyOfflineGraceFallback(context, reason)) {
      runtimeStatus.status = "ERROR";
      runtimeStatus.message = reason;
      runtimeStatus.lastCheckedAt = new Date().toISOString();
    }
  }
};

export const getLicenseRuntimeStatus = (): LicenseRuntimeStatus => ({ ...runtimeStatus });
