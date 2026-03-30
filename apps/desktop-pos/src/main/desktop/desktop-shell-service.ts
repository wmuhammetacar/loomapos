import crypto from "node:crypto";
import {
  CommerceCatalogProductDto,
  CommerceDeviceActivationDto,
  CommercePortalAuthEnvelope,
  CommercePortalCompanyDto,
  CommercePortalLicenseDto,
  checkBackendReachability,
  getCommerceJson,
  postCommerceJson,
  postCommerceWithoutBody
} from "../backend/commerce-client.js";
import { getSyncStatus } from "../sync/sync-worker.js";
import {
  appendLocalAuditLog,
  clearLocalCashierProfile,
  clearLocalActivation,
  clearLocalSession,
  endLocalUserSessions,
  ensureDeviceIdentity,
  getAppSetting,
  getLocalCashierProfile,
  getDefaultLocalBranch,
  getLocalActivation,
  getLocalSession,
  saveLocalCashierProfile,
  saveLocalActivation,
  saveLocalSession,
  setAppSetting,
  startLocalUserSession,
  touchLocalSessionValidation,
  upsertLocalBranch
} from "../storage/local-state-repository.js";
import { getRecentSales, getTenantProductStats, replaceLocalProducts, seedLocalProducts, seedOnboardingDemoProducts } from "../pos/pos-service.js";
import { LicenseRuntimeStatus, setLicenseRuntimeStatus } from "../license/license-client.js";
import { appendOutboxEvent } from "../sync/outbox-repository.js";

export type DesktopBootstrapStage = "activation_required" | "login_required" | "ready" | "locked";

export interface DesktopSessionSnapshot {
  email: string;
  displayName: string;
  companyName: string | null;
  tenantId: string | null;
  portalType: string;
  roles: string[];
  expiresAt: string;
  refreshExpiresAt: string;
  lastValidatedAt: string;
  offlineAllowedUntil: string | null;
  isOfflineSession: boolean;
}

export interface DesktopActivationSnapshot {
  activationId: string;
  tenantId: string;
  companyName: string | null;
  branchId: string;
  branchName: string;
  deviceId: string;
  deviceName: string;
  licenseId: string | null;
  licenseKey: string | null;
  planCode: string | null;
  featureFlags: string[];
  activatedAt: string;
  expiresAt: string | null;
  graceDays: number;
  lastValidationAt: string;
  offlineAllowedUntil: string | null;
  status: string;
}

export interface DesktopCashierSnapshot {
  cashierId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  operationalRole: string;
  permissions: string[];
  sourceSessionId: string | null;
}

export interface DesktopSettingsSnapshot {
  deviceId: string;
  deviceName: string;
  branchId: string | null;
  branchName: string | null;
  printerName: string | null;
  version: string;
}

export interface DesktopActivationContext {
  companyName: string;
  tenantId: string;
  billingEmail: string;
  planCode: string;
  licenseId: string;
  licenseKey: string;
  expiresAt: string;
  graceDays: number;
  deviceLimit: number | null;
  featureFlags: string[];
  suggestedDeviceName: string;
  suggestedBranchName: string;
}

export interface DesktopBootstrapState {
  stage: DesktopBootstrapStage;
  online: boolean;
  message: string | null;
  session: DesktopSessionSnapshot | null;
  cashier: DesktopCashierSnapshot | null;
  activation: DesktopActivationSnapshot | null;
  settings: DesktopSettingsSnapshot;
  license: LicenseRuntimeStatus;
  sync: ReturnType<typeof getSyncStatus>;
}

export interface DesktopActivationInput {
  branchName: string;
  branchCode?: string | null;
  deviceName: string;
}

export interface DesktopRuntimeContext {
  tenantId: string;
  branchId: string;
  branchName: string;
  deviceId: string;
  deviceName: string;
  cashierName: string;
  cashierUserId: string;
  cashierRole: string;
  canManageCatalog: boolean;
}

export interface DesktopOnboardingState {
  required: boolean;
  completedAt: string | null;
  demoSeededAt: string | null;
  demoProductCount: number;
  firstSaleDone: boolean;
  firstSaleAt: string | null;
}

const ONBOARDING_COMPLETED_AT_KEY = "desktop_onboarding_completed_at";
const ONBOARDING_DEMO_SEEDED_AT_KEY = "desktop_onboarding_demo_seeded_at";

const normalizeFeatures = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const sanitizeSession = (offlineSession: boolean): DesktopSessionSnapshot | null => {
  const session = getLocalSession();
  if (!session || !session.accessToken.trim()) {
    return null;
  }

  return {
    email: session.email,
    displayName: session.displayName,
    companyName: session.companyName,
    tenantId: session.tenantId,
    portalType: session.portalType,
    roles: session.roles,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    lastValidatedAt: session.lastValidatedAt,
    offlineAllowedUntil: session.offlineAllowedUntil,
    isOfflineSession: offlineSession
  };
};

const sanitizeActivation = (): DesktopActivationSnapshot | null => {
  const activation = getLocalActivation();
  if (!activation) {
    return null;
  }

  return {
    activationId: activation.activationId,
    tenantId: activation.tenantId,
    companyName: activation.companyName,
    branchId: activation.branchId,
    branchName: activation.branchName,
    deviceId: activation.deviceId,
    deviceName: activation.deviceName,
    licenseId: activation.licenseId,
    licenseKey: activation.licenseKey,
    planCode: activation.planCode,
    featureFlags: activation.featureFlags,
    activatedAt: activation.activatedAt,
    expiresAt: activation.expiresAt,
    graceDays: activation.graceDays,
    lastValidationAt: activation.lastValidationAt,
    offlineAllowedUntil: activation.offlineAllowedUntil,
    status: activation.status
  };
};

const sanitizeCashier = (): DesktopCashierSnapshot | null => {
  const profile = getLocalCashierProfile();
  if (!profile) {
    return null;
  }

  return {
    cashierId: profile.cashierId,
    tenantId: profile.tenantId,
    email: profile.email,
    displayName: profile.displayName,
    operationalRole: profile.operationalRole,
    permissions: profile.permissions,
    sourceSessionId: profile.sourceSessionId
  };
};

export const getDesktopSettings = (appVersion: string): DesktopSettingsSnapshot => {
  const identity = ensureDeviceIdentity(`Kasa-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
  const branch = getDefaultLocalBranch();
  return {
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    branchId: branch?.id ?? null,
    branchName: branch?.branchName ?? null,
    printerName: getAppSetting("printer_name"),
    version: appVersion
  };
};

export const getDesktopRuntimeContext = (appVersion: string): DesktopRuntimeContext => {
  const settings = getDesktopSettings(appVersion);
  const activation = getLocalActivation();
  const cashier = getLocalCashierProfile();
  const session = getLocalSession();
  if (!activation) {
    throw new Error("Cihaz henüz aktive edilmedi.");
  }

  const cashierUserId = cashier?.cashierId ?? session?.email ?? "offline-user";
  const cashierName = cashier?.displayName ?? session?.displayName ?? "Kasiyer";
  const cashierRole = cashier?.operationalRole ?? "cashier_limited";
  const canManageCatalog = cashier?.permissions.includes("catalog.manage") ?? false;

  return {
    tenantId: activation.tenantId,
    branchId: activation.branchId,
    branchName: activation.branchName,
    deviceId: activation.deviceId || settings.deviceId,
    deviceName: activation.deviceName || settings.deviceName,
    cashierName,
    cashierUserId,
    cashierRole,
    canManageCatalog
  };
};

const readOnboardingState = (tenantId: string): DesktopOnboardingState => {
  const completedAt = getAppSetting(ONBOARDING_COMPLETED_AT_KEY);
  const demoSeededAt = getAppSetting(ONBOARDING_DEMO_SEEDED_AT_KEY);
  const productStats = getTenantProductStats(tenantId);
  const latestSale = getRecentSales(tenantId, 1)[0] ?? null;

  return {
    required: !completedAt,
    completedAt: completedAt ?? null,
    demoSeededAt: demoSeededAt ?? null,
    demoProductCount: productStats.totalProducts,
    firstSaleDone: latestSale !== null,
    firstSaleAt: latestSale?.createdAt ?? null
  };
};

export const getDesktopOnboardingState = (appVersion: string): DesktopOnboardingState => {
  const context = getDesktopRuntimeContext(appVersion);
  return readOnboardingState(context.tenantId);
};

export const seedDesktopOnboardingDemo = (appVersion: string): DesktopOnboardingState => {
  const context = getDesktopRuntimeContext(appVersion);
  seedOnboardingDemoProducts(context.tenantId, context.branchId);
  setAppSetting(ONBOARDING_DEMO_SEEDED_AT_KEY, new Date().toISOString());

  appendLocalAuditLog({
    tenantId: context.tenantId,
    branchId: context.branchId,
    deviceId: context.deviceId,
    actorUserId: context.cashierUserId,
    actorEmail: getLocalSession()?.email ?? null,
    actorName: context.cashierName,
    eventType: "desktop_onboarding_demo_seeded",
    message: "Ilk kurulum demo urunleri yuklendi."
  });

  return readOnboardingState(context.tenantId);
};

export const completeDesktopOnboarding = (appVersion: string): DesktopOnboardingState => {
  const context = getDesktopRuntimeContext(appVersion);
  const current = readOnboardingState(context.tenantId);
  if (current.completedAt) {
    return current;
  }
  if (!current.firstSaleDone) {
    throw new Error("Onboarding tamamlanmadan once en az bir test satisi tamamlayin.");
  }

  const completedAt = new Date().toISOString();
  setAppSetting(ONBOARDING_COMPLETED_AT_KEY, completedAt);

  appendLocalAuditLog({
    tenantId: context.tenantId,
    branchId: context.branchId,
    deviceId: context.deviceId,
    actorUserId: context.cashierUserId,
    actorEmail: getLocalSession()?.email ?? null,
    actorName: context.cashierName,
    eventType: "desktop_onboarding_completed",
    message: "Ilk kurulum adimlari tamamlandi.",
    payload: {
      completedAt
    }
  });

  return readOnboardingState(context.tenantId);
};

export const getDesktopBootstrapState = async (appVersion: string): Promise<DesktopBootstrapState> => {
  const online = await checkBackendReachability();
  let message: string | null = null;
  let offlineSession = false;
  let stage: DesktopBootstrapStage = "activation_required";

  const settings = getDesktopSettings(appVersion);
  const session = getLocalSession();
  const activation = getLocalActivation();

  const sessionUsable = evaluateSessionUsability(session, online);
  offlineSession = sessionUsable === "offline";

  const activationState = await refreshActivationSnapshot(appVersion, online, session?.accessToken ?? null);
  const currentActivation = activationState.activation;
  message = activationState.message;

  if (!currentActivation) {
    stage = "activation_required";
  } else if (activationState.locked) {
    stage = "locked";
  } else if (sessionUsable === "missing") {
    stage = "login_required";
  } else {
    stage = "ready";
  }

  return {
    stage,
    online,
    message,
    session: sanitizeSession(offlineSession),
    cashier: sanitizeCashier(),
    activation: sanitizeActivation(),
    settings,
    license: activationState.license,
    sync: getSyncStatus()
  };
};

export const loginDesktopUser = async (
  appVersion: string,
  input: {
    email: string;
    password: string;
  }
) => {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password.trim()) {
    throw new Error("E-posta ve sifre zorunlu.");
  }

  const response = await postCommerceJson<CommercePortalAuthEnvelope>(
    "/commerce/auth/desktop-login",
    {
      email,
      password: input.password
    }
  );

  saveLocalSession({
    tenantId: response.tenantId ?? null,
    email: response.email,
    displayName: response.displayName,
    companyName: response.companyName ?? null,
    portalType: response.portalType,
    roles: response.roles,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: response.expiresAt,
    refreshExpiresAt: response.refreshExpiresAt
  });

  const operational = deriveOperationalRole(response.roles, response.portalType);
  const cashierId = buildCashierId(response.tenantId ?? "global", response.email);
  saveLocalCashierProfile({
    cashierId,
    tenantId: response.tenantId ?? null,
    email: response.email,
    displayName: response.displayName,
    operationalRole: operational.role,
    permissions: operational.permissions,
    sourceSessionId: getLocalSession()?.sessionId ?? null
  });

  appendLocalAuditLog({
    tenantId: response.tenantId ?? null,
    actorUserId: cashierId,
    actorEmail: response.email,
    actorName: response.displayName,
    eventType: "desktop_login",
    message: "Desktop kullanicisi giris yapti.",
    payload: {
      portalType: response.portalType,
      roles: response.roles
    }
  });

  if (response.tenantId) {
    startLocalUserSession({
      tenantId: response.tenantId,
      branchId: getLocalActivation()?.branchId ?? null,
      deviceId: getLocalActivation()?.deviceId ?? null,
      actorEmail: response.email,
      actorName: response.displayName
    });

    const activation = getLocalActivation();
    if (activation) {
      appendOutboxEvent({
        tenantId: response.tenantId,
        branchId: activation.branchId,
        deviceId: activation.deviceId,
        eventType: "USER_SESSION_STARTED",
        aggregateType: "user_session",
        aggregateId: cashierId,
        payload: {
          actorUserId: cashierId,
          actorEmail: response.email,
          actorName: response.displayName,
          roles: response.roles,
          startedAt: new Date().toISOString()
        }
      });
    }
  }

  return getDesktopBootstrapState(appVersion);
};

export const logoutDesktopUser = async (appVersion: string) => {
  const session = getLocalSession();
  const cashier = getLocalCashierProfile();
  if (session?.accessToken) {
    try {
      await postCommerceWithoutBody<{ loggedOut: true }>("/commerce/auth/logout", {
        accessToken: session.accessToken
      });
    } catch {
      // Local logout must still succeed.
    }
  }

  appendLocalAuditLog({
    tenantId: session?.tenantId ?? null,
    branchId: getLocalActivation()?.branchId ?? null,
    deviceId: getLocalActivation()?.deviceId ?? null,
    actorUserId: cashier?.cashierId ?? null,
    actorEmail: session?.email ?? null,
    actorName: session?.displayName ?? null,
    eventType: "desktop_logout",
    message: "Desktop kullanicisi cikis yapti."
  });

  if (session?.tenantId) {
    endLocalUserSessions({
      tenantId: session.tenantId,
      actorEmail: session.email
    });

    const activation = getLocalActivation();
    if (activation) {
      appendOutboxEvent({
        tenantId: session.tenantId,
        branchId: activation.branchId,
        deviceId: activation.deviceId,
        eventType: "USER_SESSION_ENDED",
        aggregateType: "user_session",
        aggregateId: cashier?.cashierId ?? session.email.toLowerCase(),
        payload: {
          actorUserId: cashier?.cashierId ?? null,
          actorEmail: session.email,
          actorName: session.displayName,
          endedAt: new Date().toISOString()
        }
      });
    }
  }

  clearLocalCashierProfile();
  clearLocalSession();
  return getDesktopBootstrapState(appVersion);
};

export const getDesktopActivationContext = async (appVersion: string): Promise<DesktopActivationContext> => {
  const session = getLocalSession();
  if (!session?.accessToken) {
    throw new Error("Aktivasyon icin once giris yapin.");
  }

  const [company, license] = await Promise.all([
    getCommerceJson<CommercePortalCompanyDto>("/commerce/portal/company", {
      accessToken: session.accessToken,
      headers: session.tenantId ? { "X-Tenant-Id": session.tenantId } : undefined
    }),
    getCommerceJson<CommercePortalLicenseDto>("/commerce/portal/licenses/active", {
      accessToken: session.accessToken,
      headers: session.tenantId ? { "X-Tenant-Id": session.tenantId } : undefined
    })
  ]);

  touchLocalSessionValidation();

  const settings = getDesktopSettings(appVersion);
  const branch = getDefaultLocalBranch();

  return {
    companyName: company.companyName,
    tenantId: company.id,
    billingEmail: company.billingEmail,
    planCode: license.planCode,
    licenseId: license.id,
    licenseKey: license.licenseKey,
    expiresAt: license.expiresAt,
    graceDays: license.graceDays,
    deviceLimit: license.deviceLimit ?? null,
    featureFlags: normalizeFeatures(license.featuresJson),
    suggestedDeviceName: settings.deviceName,
    suggestedBranchName: branch?.branchName ?? "Merkez Sube"
  };
};

export const activateDesktopDevice = async (appVersion: string, input: DesktopActivationInput) => {
  const session = getLocalSession();
  if (!session?.accessToken) {
    throw new Error("Aktivasyon icin once giris yapin.");
  }

  const normalizedBranchName = input.branchName.trim();
  const normalizedDeviceName = input.deviceName.trim();
  if (!normalizedBranchName || !normalizedDeviceName) {
    throw new Error("Sube adi ve cihaz adi zorunlu.");
  }

  const [company, license] = await Promise.all([
    getCommerceJson<CommercePortalCompanyDto>("/commerce/portal/company", {
      accessToken: session.accessToken,
      headers: session.tenantId ? { "X-Tenant-Id": session.tenantId } : undefined
    }),
    getCommerceJson<CommercePortalLicenseDto>("/commerce/portal/licenses/active", {
      accessToken: session.accessToken,
      headers: session.tenantId ? { "X-Tenant-Id": session.tenantId } : undefined
    })
  ]);

  const identity = ensureDeviceIdentity(normalizedDeviceName);
  setAppSetting("device_name", normalizedDeviceName);

  const activation = await postCommerceJson<CommerceDeviceActivationDto>(
    "/commerce/license/activate",
    {
      licenseToken: license.licenseToken,
      deviceId: identity.deviceId,
      deviceName: normalizedDeviceName,
      platform: "desktop",
      appVersion,
      source: "desktop"
    }
  );

  const branchId = getLocalActivation()?.branchId ?? getDefaultLocalBranch()?.id ?? crypto.randomUUID();
  upsertLocalBranch({
    id: branchId,
    tenantId: company.id,
    branchCode: input.branchCode?.trim() || null,
    branchName: normalizedBranchName,
    isDefault: true
  });

  const lastValidationAt = new Date().toISOString();
  const offlineAllowedUntil = new Date(
    Date.now() + Math.max(1, license.graceDays) * 24 * 60 * 60 * 1000
  ).toISOString();

  saveLocalActivation({
    activationId: activation.id,
    tenantId: company.id,
    companyName: company.companyName,
    branchId,
    branchName: normalizedBranchName,
    deviceId: identity.deviceId,
    deviceName: normalizedDeviceName,
    licenseId: license.id,
    licenseKey: license.licenseKey,
    licenseToken: license.licenseToken,
    planCode: license.planCode,
    featureFlags: normalizeFeatures(license.featuresJson),
    activatedAt: activation.activatedAt,
    expiresAt: license.expiresAt,
    graceDays: license.graceDays,
    lastValidationAt,
    offlineAllowedUntil,
    status: "active"
  });

  touchLocalSessionValidation();
  await hydrateCatalog(company.id, session.accessToken);
  setLicenseRuntimeStatus(buildLicenseRuntimeStatus(getLocalActivation(), null, "ACTIVE"));

  appendLocalAuditLog({
    tenantId: company.id,
    branchId,
    deviceId: identity.deviceId,
    actorUserId: getLocalCashierProfile()?.cashierId ?? null,
    actorEmail: session.email,
    actorName: session.displayName,
    eventType: "desktop_activation_completed",
    message: "Desktop cihaz aktivasyonu tamamlandi.",
    payload: {
      planCode: license.planCode,
      licenseId: license.id,
      activationId: activation.id,
      branchName: normalizedBranchName
    }
  });

  return getDesktopBootstrapState(appVersion);
};

export const clearDesktopActivation = async (appVersion: string) => {
  const session = getLocalSession();
  const cashier = getLocalCashierProfile();
  const activation = getLocalActivation();
  if (activation?.deviceId) {
    try {
      await postCommerceJson<{ deactivated: boolean }>(
        "/commerce/license/deactivate",
        {
          deviceId: activation.deviceId
        }
      );
    } catch {
      // Local cleanup should still proceed.
    }
  }

  appendLocalAuditLog({
    tenantId: activation?.tenantId ?? null,
    branchId: activation?.branchId ?? null,
    deviceId: activation?.deviceId ?? null,
    actorUserId: cashier?.cashierId ?? null,
    actorEmail: session?.email ?? null,
    actorName: session?.displayName ?? null,
    eventType: "desktop_activation_cleared",
    message: "Desktop aktivasyon kaydi temizlendi."
  });

  clearLocalActivation();
  setLicenseRuntimeStatus(buildLicenseRuntimeStatus(null, "Aktivasyon kaydi bulunamadi.", "UNKNOWN"));
  return getDesktopBootstrapState(appVersion);
};

export const updateDesktopSettings = (appVersion: string, input: { deviceName?: string; printerName?: string | null }) => {
  const cashier = getLocalCashierProfile();
  const deviceName = input.deviceName?.trim();
  if (deviceName) {
    setAppSetting("device_name", deviceName);
    const activation = getLocalActivation();
    if (activation) {
      saveLocalActivation({
        ...toActivationWriteModel(activation),
        deviceName
      });
    }
  }

  if (input.printerName !== undefined) {
    setAppSetting("printer_name", input.printerName?.trim() || "");
  }

  appendLocalAuditLog({
    tenantId: getLocalActivation()?.tenantId ?? null,
    branchId: getLocalActivation()?.branchId ?? null,
    deviceId: getLocalActivation()?.deviceId ?? null,
    actorUserId: cashier?.cashierId ?? null,
    actorEmail: getLocalSession()?.email ?? null,
    actorName: getLocalSession()?.displayName ?? null,
    eventType: "desktop_settings_updated",
    message: "Desktop cihaz ayarlari guncellendi.",
    payload: input
  });

  return getDesktopSettings(appVersion);
};

const evaluateSessionUsability = (session: ReturnType<typeof getLocalSession>, online: boolean) => {
  if (!session || !session.accessToken.trim()) {
    return "missing" as const;
  }

  const offlineUntil = session.offlineAllowedUntil ? new Date(session.offlineAllowedUntil).getTime() : 0;
  if (offlineUntil <= Date.now()) {
    return "missing" as const;
  }

  if (!online && offlineUntil > Date.now()) {
    return "offline" as const;
  }

  return "online" as const;
};

const refreshActivationSnapshot = async (appVersion: string, online: boolean, accessToken: string | null) => {
  const activation = getLocalActivation();
  if (!activation) {
    const license = buildLicenseRuntimeStatus(null, "Cihaz aktivasyonu bekleniyor.", "UNKNOWN");
    setLicenseRuntimeStatus(license);
    return {
      activation: null,
      locked: false,
      message: "Cihaz henuz aktive edilmedi.",
      license
    };
  }

  if (!online) {
    const locked = !activation.offlineAllowedUntil || new Date(activation.offlineAllowedUntil).getTime() <= Date.now();
    const status = locked ? "LOCKED" : "READ_ONLY";
    const message = locked
      ? "Offline grace suresi doldu. Yeniden baglanti ve lisans dogrulamasi gerekli."
      : `Offline modda calisiliyor. Grace bitis: ${activation.offlineAllowedUntil}`;
    const license = buildLicenseRuntimeStatus(activation, message, status);
    setLicenseRuntimeStatus(license);
    return {
      activation,
      locked,
      message,
      license
    };
  }

  try {
    const heartbeat = await postCommerceJson<{
      deviceId: string;
      lastSeenAt: string;
      status: string;
      licenseStatus?: string | null;
      expiresAt?: string | null;
      lifecycleState?: string | null;
      canCheckout?: boolean;
      canWrite?: boolean;
      canSync?: boolean;
      canView?: boolean;
      requiresUpgradeAction?: boolean;
      requiresBlock?: boolean;
      allowedActions?: string[];
      blockedActions?: string[];
    }>("/commerce/license/heartbeat", {
      deviceId: activation.deviceId,
      appVersion
    });

    let refreshedLicense: CommercePortalLicenseDto | null = null;
    if (accessToken) {
      try {
        refreshedLicense = await getCommerceJson<CommercePortalLicenseDto>("/commerce/portal/licenses/active", {
          accessToken,
          headers: { "X-Tenant-Id": activation.tenantId }
        });
        touchLocalSessionValidation();
      } catch {
        refreshedLicense = null;
      }
    }

    const lastValidationAt = new Date().toISOString();
    const graceDays = refreshedLicense?.graceDays ?? activation.graceDays;
    const offlineAllowedUntil = new Date(
      Date.now() + Math.max(1, graceDays) * 24 * 60 * 60 * 1000
    ).toISOString();

      saveLocalActivation({
        ...toActivationWriteModel(activation),
        companyName: getLocalSession()?.companyName ?? activation.companyName,
      licenseId: refreshedLicense?.id ?? activation.licenseId,
      licenseKey: refreshedLicense?.licenseKey ?? activation.licenseKey,
      licenseToken: refreshedLicense?.licenseToken ?? activation.licenseToken,
      planCode: refreshedLicense?.planCode ?? activation.planCode,
      featureFlags: refreshedLicense ? normalizeFeatures(refreshedLicense.featuresJson) : activation.featureFlags,
      expiresAt: refreshedLicense?.expiresAt ?? heartbeat.expiresAt ?? activation.expiresAt,
      graceDays,
      lastValidationAt,
      offlineAllowedUntil,
      status:
        heartbeat.lifecycleState?.toLowerCase() ??
        (heartbeat.licenseStatus?.toLowerCase() === "active" ? "subscription_active" : activation.status)
    });

    if (accessToken) {
      await hydrateCatalog(activation.tenantId, accessToken);
    }

    const normalizedActivation = getLocalActivation();
    const lifecycleState = normalizeDesktopLifecycleState(heartbeat.lifecycleState ?? activation.status);
    const locked = heartbeat.requiresBlock === true || lifecycleState === "suspended_blocked";
    const license = buildLicenseRuntimeStatus(normalizedActivation, null, locked ? "LOCKED" : "ACTIVE");
    setLicenseRuntimeStatus(license);

    return {
      activation: normalizedActivation,
      locked,
      message: locked ? "Lisans veya abonelik durumu cihaz kullanimina izin vermiyor." : null,
      license
    };
  } catch (error) {
    const locked = !activation.offlineAllowedUntil || new Date(activation.offlineAllowedUntil).getTime() <= Date.now();
    const message = error instanceof Error ? error.message : "Lisans dogrulamasi basarisiz.";
    const license = buildLicenseRuntimeStatus(activation, message, locked ? "LOCKED" : "READ_ONLY");
    setLicenseRuntimeStatus(license);
    return {
      activation,
      locked,
      message,
      license
    };
  }
};

type DesktopLifecycleState =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_canceled"
  | "suspended_blocked";

const normalizeDesktopLifecycleState = (rawState: string | null | undefined): DesktopLifecycleState => {
  const normalized = (rawState ?? "").trim().toLowerCase();
  if (normalized === "trial_active") {
    return "trial_active";
  }
  if (normalized === "trial_expiring" || normalized === "trial_expiring_soon") {
    return "trial_expiring";
  }
  if (normalized === "trial_expired" || normalized === "trial_expired_read_only") {
    return "trial_expired";
  }
  if (normalized === "subscription_past_due" || normalized === "past_due" || normalized === "past-due") {
    return "subscription_past_due";
  }
  if (normalized === "subscription_canceled" || normalized === "canceled" || normalized === "cancelled") {
    return "subscription_canceled";
  }
  if (normalized === "suspended_blocked" || normalized === "suspended" || normalized === "blocked" || normalized === "revoked") {
    return "suspended_blocked";
  }
  return "subscription_active";
};

const resolveDesktopLifecyclePolicy = (rawState: string | null | undefined) => {
  const state = normalizeDesktopLifecycleState(rawState);

  if (state === "trial_expired") {
    return {
      state,
      allowedActions: ["Rapor goruntuleme", "Durum izleme"],
      blockedActions: ["Satis", "Stok mutasyonu", "Sync push", "Yeni cihaz aktivasyonu"],
      canCheckout: false,
      canWrite: false,
      canSync: false,
      canView: true,
      requiresUpgradeAction: true,
      requiresBlock: false
    };
  }

  if (state === "subscription_past_due") {
    return {
      state,
      allowedActions: ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
      blockedActions: ["Yeni cihaz aktivasyonu"],
      canCheckout: true,
      canWrite: true,
      canSync: true,
      canView: true,
      requiresUpgradeAction: true,
      requiresBlock: false
    };
  }

  if (state === "subscription_canceled") {
    return {
      state,
      allowedActions: ["Desktop satis", "Mobil operasyon", "Senkron yazma"],
      blockedActions: ["Yeni cihaz aktivasyonu"],
      canCheckout: true,
      canWrite: true,
      canSync: true,
      canView: true,
      requiresUpgradeAction: true,
      requiresBlock: false
    };
  }

  if (state === "suspended_blocked") {
    return {
      state,
      allowedActions: ["Rapor goruntuleme", "Durum izleme"],
      blockedActions: ["Satis", "Stok mutasyonu", "Sync push", "Cihaz aktivasyonu"],
      canCheckout: false,
      canWrite: false,
      canSync: false,
      canView: true,
      requiresUpgradeAction: true,
      requiresBlock: true
    };
  }

  if (state === "trial_expiring") {
    return {
      state,
      allowedActions: ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
      blockedActions: ["-"],
      canCheckout: true,
      canWrite: true,
      canSync: true,
      canView: true,
      requiresUpgradeAction: true,
      requiresBlock: false
    };
  }

  if (state === "trial_active") {
    return {
      state,
      allowedActions: ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
      blockedActions: ["-"],
      canCheckout: true,
      canWrite: true,
      canSync: true,
      canView: true,
      requiresUpgradeAction: false,
      requiresBlock: false
    };
  }

  return {
    state: "subscription_active" as const,
    allowedActions: ["Desktop satis", "Mobil operasyon", "Cihaz aktivasyonu", "Senkron yazma"],
    blockedActions: ["-"],
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: false,
    requiresBlock: false
  };
};

const buildLicenseRuntimeStatus = (
  activation: ReturnType<typeof getLocalActivation>,
  message: string | null,
  status: LicenseRuntimeStatus["status"]
): LicenseRuntimeStatus => {
  if (!activation) {
    return {
      status,
      planCode: null,
      expiresAt: null,
      graceDays: null,
      maxDevices: null,
      activeDevices: null,
      message,
      lastCheckedAt: new Date().toISOString(),
      lifecycleState: null,
      allowedActions: [],
      blockedActions: [],
      canCheckout: false,
      canWrite: false,
      canSync: false,
      canView: true,
      requiresUpgradeAction: false,
      requiresBlock: status === "LOCKED"
    };
  }

  const policy = resolveDesktopLifecyclePolicy(activation.status ?? null);
  return {
    status,
    planCode: activation?.planCode ?? null,
    expiresAt: activation?.expiresAt ?? null,
    graceDays: activation?.graceDays ?? null,
    maxDevices: null,
    activeDevices: null,
    message,
    lastCheckedAt: activation?.lastValidationAt ?? new Date().toISOString(),
    lifecycleState: policy.state,
    allowedActions: policy.allowedActions,
    blockedActions: policy.blockedActions,
    canCheckout: policy.canCheckout,
    canWrite: policy.canWrite,
    canSync: policy.canSync,
    canView: policy.canView,
    requiresUpgradeAction: policy.requiresUpgradeAction,
    requiresBlock: policy.requiresBlock
  };
};

const toActivationWriteModel = (activation: NonNullable<ReturnType<typeof getLocalActivation>>) => ({
  activationId: activation.activationId,
  tenantId: activation.tenantId,
  companyName: activation.companyName,
  branchId: activation.branchId,
  branchName: activation.branchName,
  deviceId: activation.deviceId,
  deviceName: activation.deviceName,
  licenseId: activation.licenseId,
  licenseKey: activation.licenseKey,
  licenseToken: activation.licenseToken,
  planCode: activation.planCode,
  featureFlags: activation.featureFlags,
  activatedAt: activation.activatedAt,
  expiresAt: activation.expiresAt,
  graceDays: activation.graceDays,
  lastValidationAt: activation.lastValidationAt,
  offlineAllowedUntil: activation.offlineAllowedUntil,
  status: activation.status
});

const hydrateCatalog = async (tenantId: string, accessToken: string) => {
  try {
    const rows = await getCommerceJson<CommerceCatalogProductDto[]>("/commerce/portal/catalog/products", {
      accessToken,
      headers: { "X-Tenant-Id": tenantId }
    });
    if (rows.length > 0) {
      replaceLocalProducts(tenantId, rows.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku ?? null,
        barcode: row.barcode ?? null,
        unit: row.unit,
        taxRate: Number(row.taxRate ?? 0),
        price: Number(row.price ?? 0),
        isActive: row.isActive,
        updatedAt: row.updatedAt ?? null
      })));
      return;
    }
  } catch {
    // If cloud catalog pull fails, seeded local fallback keeps POS usable.
  }

  seedLocalProducts(tenantId);
};

const buildCashierId = (tenantId: string, email: string) => {
  return crypto
    .createHash("sha256")
    .update(`${tenantId}:${email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
};

const deriveOperationalRole = (
  roles: string[],
  portalType: CommercePortalAuthEnvelope["portalType"]
): { role: string; permissions: string[] } => {
  const normalizedRoles = roles.map((item) => item.toLowerCase());
  if (portalType !== "customer") {
    return {
      role: "cashier_limited",
      permissions: ["sale.capture", "cart.edit"]
    };
  }

  if (normalizedRoles.some((role) => ["tenant_owner", "company_admin", "tenant_admin"].includes(role))) {
    return {
      role: "branch_manager",
      permissions: ["sale.capture", "cart.edit", "refund.process", "cash.adjust", "shift.close", "catalog.manage", "settings.view"]
    };
  }

  if (normalizedRoles.some((role) => ["support_contact", "billing_admin", "read_only_portal_user"].includes(role))) {
    return {
      role: "cashier_limited",
      permissions: ["sale.capture", "cart.edit"]
    };
  }

  return {
    role: "cashier",
    permissions: ["sale.capture", "cart.edit", "refund.process", "cash.adjust"]
  };
};
