import crypto from "node:crypto";
import { safeStorage } from "electron";
import { getDatabase } from "./local-db.js";

export interface LocalSessionRecord {
  sessionId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  companyName: string | null;
  portalType: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
  lastValidatedAt: string;
  offlineAllowedUntil: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalActivationRecord {
  activationId: string;
  tenantId: string;
  companyName: string | null;
  branchId: string;
  branchName: string;
  deviceId: string;
  deviceName: string;
  licenseId: string | null;
  licenseKey: string | null;
  licenseToken: string | null;
  planCode: string | null;
  featureFlags: string[];
  activatedAt: string;
  expiresAt: string | null;
  graceDays: number;
  lastValidationAt: string;
  offlineAllowedUntil: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalBranchRecord {
  id: string;
  tenantId: string;
  branchCode: string | null;
  branchName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalCashierProfileRecord {
  cashierId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  operationalRole: string;
  permissions: string[];
  sourceSessionId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartDraftRecord {
  draftId: string;
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string | null;
  payloadJson: string;
  updatedAt: string;
  createdAt: string;
}

export interface SyncStateRecord {
  syncScope: string;
  pendingCount: number;
  failedCount: number;
  sentCount: number;
  deadLetterCount: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastPullAt: string | null;
  lastHeartbeatAt: string | null;
  connectionQuality: string | null;
  blockedReason: string | null;
  lastError: string | null;
  updatedAt: string;
}

export interface LocalUserSessionRecord {
  localUserSessionId: string;
  tenantId: string;
  branchId: string | null;
  deviceId: string | null;
  actorEmail: string;
  actorName: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_OFFLINE_DAYS = 3;

export const getAppSetting = (key: string): string | null => {
  const db = getDatabase();
  const row = db
    .prepare("SELECT setting_value AS value FROM app_settings WHERE setting_key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

export const setAppSetting = (key: string, value: string) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings(setting_key, setting_value, updated_at)
    VALUES(@key, @value, @updatedAt)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at
  `).run({
    key,
    value,
    updatedAt: now
  });
};

export const getNumericAppSetting = (key: string, fallback = 0): number => {
  const raw = getAppSetting(key);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const incrementAppCounter = (key: string, startingValue = 1): number => {
  const nextValue = getNumericAppSetting(key, startingValue - 1) + 1;
  setAppSetting(key, String(nextValue));
  return nextValue;
};

export const ensureDeviceIdentity = (defaultDeviceName: string) => {
  let deviceId = getAppSetting("device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    setAppSetting("device_id", deviceId);
  }

  let deviceName = getAppSetting("device_name");
  if (!deviceName) {
    deviceName = defaultDeviceName;
    setAppSetting("device_name", deviceName);
  }

  return {
    deviceId,
    deviceName
  };
};

export const getLocalSession = (): LocalSessionRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        session_id AS sessionId,
        tenant_id AS tenantId,
        email,
        display_name AS displayName,
        company_name AS companyName,
        portal_type AS portalType,
        roles_json AS rolesJson,
        access_token AS accessToken,
        refresh_token AS refreshToken,
        expires_at AS expiresAt,
        refresh_expires_at AS refreshExpiresAt,
        last_validated_at AS lastValidatedAt,
        offline_allowed_until AS offlineAllowedUntil,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_session
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    .get() as
    | (Omit<LocalSessionRecord, "roles"> & {
        rolesJson: string;
      })
    | undefined;

  if (!row) {
    return null;
  }

  return {
    sessionId: row.sessionId,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    companyName: row.companyName,
    portalType: row.portalType,
    roles: safeJsonArray(row.rolesJson),
    accessToken: revealSecret(row.accessToken),
    refreshToken: revealSecret(row.refreshToken),
    expiresAt: row.expiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
    lastValidatedAt: row.lastValidatedAt,
    offlineAllowedUntil: row.offlineAllowedUntil,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

export const saveLocalSession = (session: {
  tenantId: string | null;
  email: string;
  displayName: string;
  companyName: string | null;
  portalType: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const offlineAllowedUntil = new Date(
    Date.now() + SESSION_OFFLINE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  db.exec("DELETE FROM local_session;");
  db.prepare(`
    INSERT INTO local_session(
      session_id,
      tenant_id,
      email,
      display_name,
      company_name,
      portal_type,
      roles_json,
      access_token,
      refresh_token,
      expires_at,
      refresh_expires_at,
      last_validated_at,
      offline_allowed_until,
      status,
      created_at,
      updated_at
    )
    VALUES(
      @sessionId,
      @tenantId,
      @email,
      @displayName,
      @companyName,
      @portalType,
      @rolesJson,
      @accessToken,
      @refreshToken,
      @expiresAt,
      @refreshExpiresAt,
      @lastValidatedAt,
      @offlineAllowedUntil,
      'active',
      @createdAt,
      @updatedAt
    )
  `).run({
    sessionId,
    tenantId: session.tenantId,
    email: session.email.toLowerCase(),
    displayName: session.displayName,
    companyName: session.companyName,
    portalType: session.portalType,
    rolesJson: JSON.stringify(session.roles),
    accessToken: protectSecret(session.accessToken),
    refreshToken: protectSecret(session.refreshToken),
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    lastValidatedAt: now,
    offlineAllowedUntil,
    createdAt: now,
    updatedAt: now
  });

  upsertLocalUser({
    userId: session.email.toLowerCase(),
    tenantId: session.tenantId,
    email: session.email,
    fullName: session.displayName,
    companyName: session.companyName,
    portalType: session.portalType,
    roles: session.roles,
    status: "active",
    lastLoginAt: now
  });
};

export const touchLocalSessionValidation = () => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const offlineAllowedUntil = new Date(
    Date.now() + SESSION_OFFLINE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(`
    UPDATE local_session
    SET
      last_validated_at = @lastValidatedAt,
      offline_allowed_until = @offlineAllowedUntil,
      updated_at = @updatedAt,
      status = 'active'
  `).run({
    lastValidatedAt: now,
    offlineAllowedUntil,
    updatedAt: now
  });
};

export const clearLocalSession = () => {
  const db = getDatabase();
  db.exec("DELETE FROM local_session;");
};

export const getLocalCashierProfile = (): LocalCashierProfileRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        cashier_id AS cashierId,
        tenant_id AS tenantId,
        email,
        display_name AS displayName,
        operational_role AS operationalRole,
        permissions_json AS permissionsJson,
        source_session_id AS sourceSessionId,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_cashier_profiles
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    .get() as
    | (Omit<LocalCashierProfileRecord, "permissions"> & {
        permissionsJson: string;
      })
    | undefined;

  if (!row) {
    return null;
  }

  return {
    cashierId: row.cashierId,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    operationalRole: row.operationalRole,
    permissions: safeJsonArray(row.permissionsJson),
    sourceSessionId: row.sourceSessionId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

export const saveLocalCashierProfile = (profile: {
  cashierId: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  operationalRole: string;
  permissions: string[];
  sourceSessionId?: string | null;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO local_cashier_profiles(
      cashier_id,
      tenant_id,
      email,
      display_name,
      operational_role,
      permissions_json,
      source_session_id,
      status,
      created_at,
      updated_at
    )
    VALUES(
      @cashierId,
      @tenantId,
      @email,
      @displayName,
      @operationalRole,
      @permissionsJson,
      @sourceSessionId,
      'active',
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(cashier_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      email = excluded.email,
      display_name = excluded.display_name,
      operational_role = excluded.operational_role,
      permissions_json = excluded.permissions_json,
      source_session_id = excluded.source_session_id,
      status = 'active',
      updated_at = excluded.updated_at
  `).run({
    cashierId: profile.cashierId,
    tenantId: profile.tenantId,
    email: profile.email.toLowerCase(),
    displayName: profile.displayName,
    operationalRole: profile.operationalRole,
    permissionsJson: JSON.stringify(profile.permissions),
    sourceSessionId: profile.sourceSessionId ?? null,
    createdAt: now,
    updatedAt: now
  });
};

export const clearLocalCashierProfile = () => {
  const db = getDatabase();
  db.exec("DELETE FROM local_cashier_profiles;");
};

export const updateLocalSessionRoles = (roles: string[]) => {
  const db = getDatabase();
  db.prepare(`
    UPDATE local_session
    SET roles_json = @rolesJson, updated_at = @updatedAt
  `).run({
    rolesJson: JSON.stringify(roles),
    updatedAt: new Date().toISOString()
  });
};

export const getLocalActivation = (): LocalActivationRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        activation_id AS activationId,
        tenant_id AS tenantId,
        company_name AS companyName,
        branch_id AS branchId,
        branch_name AS branchName,
        device_id AS deviceId,
        device_name AS deviceName,
        license_id AS licenseId,
        license_key AS licenseKey,
        license_token AS licenseToken,
        plan_code AS planCode,
        feature_flags_json AS featureFlagsJson,
        activated_at AS activatedAt,
        expires_at AS expiresAt,
        grace_days AS graceDays,
        last_validation_at AS lastValidationAt,
        offline_allowed_until AS offlineAllowedUntil,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_activation
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    .get() as
    | (Omit<LocalActivationRecord, "featureFlags"> & {
        featureFlagsJson: string;
      })
    | undefined;

  if (!row) {
    return null;
  }

  return {
    activationId: row.activationId,
    tenantId: row.tenantId,
    companyName: row.companyName,
    branchId: row.branchId,
    branchName: row.branchName,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    licenseId: row.licenseId,
    licenseKey: row.licenseKey,
    licenseToken: row.licenseToken,
    planCode: row.planCode,
    featureFlags: safeJsonArray(row.featureFlagsJson),
    activatedAt: row.activatedAt,
    expiresAt: row.expiresAt,
    graceDays: Number(row.graceDays ?? 7),
    lastValidationAt: row.lastValidationAt,
    offlineAllowedUntil: row.offlineAllowedUntil,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

export const saveLocalActivation = (activation: Omit<LocalActivationRecord, "createdAt" | "updatedAt">) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.exec("DELETE FROM local_activation;");
  db.prepare(`
    INSERT INTO local_activation(
      activation_id,
      tenant_id,
      company_name,
      branch_id,
      branch_name,
      device_id,
      device_name,
      license_id,
      license_key,
      license_token,
      plan_code,
      feature_flags_json,
      activated_at,
      expires_at,
      grace_days,
      last_validation_at,
      offline_allowed_until,
      status,
      created_at,
      updated_at
    )
    VALUES(
      @activationId,
      @tenantId,
      @companyName,
      @branchId,
      @branchName,
      @deviceId,
      @deviceName,
      @licenseId,
      @licenseKey,
      @licenseToken,
      @planCode,
      @featureFlagsJson,
      @activatedAt,
      @expiresAt,
      @graceDays,
      @lastValidationAt,
      @offlineAllowedUntil,
      @status,
      @createdAt,
      @updatedAt
    )
  `).run({
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
    featureFlagsJson: JSON.stringify(activation.featureFlags),
    activatedAt: activation.activatedAt,
    expiresAt: activation.expiresAt,
    graceDays: activation.graceDays,
    lastValidationAt: activation.lastValidationAt,
    offlineAllowedUntil: activation.offlineAllowedUntil,
    status: activation.status,
    createdAt: now,
    updatedAt: now
  });
};

export const clearLocalActivation = () => {
  const db = getDatabase();
  db.exec("DELETE FROM local_activation;");
};

export const upsertLocalBranch = (branch: {
  id: string;
  tenantId: string;
  branchCode: string | null;
  branchName: string;
  isDefault: boolean;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  if (branch.isDefault) {
    db.prepare("UPDATE local_branches SET is_default = 0").run();
  }

  db.prepare(`
    INSERT INTO local_branches(id, tenant_id, branch_code, branch_name, is_default, created_at, updated_at)
    VALUES(@id, @tenantId, @branchCode, @branchName, @isDefault, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      branch_code = excluded.branch_code,
      branch_name = excluded.branch_name,
      is_default = excluded.is_default,
      updated_at = excluded.updated_at
  `).run({
    id: branch.id,
    tenantId: branch.tenantId,
    branchCode: branch.branchCode,
    branchName: branch.branchName,
    isDefault: branch.isDefault ? 1 : 0,
    createdAt: now,
    updatedAt: now
  });
};

export const getDefaultLocalBranch = (): LocalBranchRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        id,
        tenant_id AS tenantId,
        branch_code AS branchCode,
        branch_name AS branchName,
        is_default AS isDefault,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM local_branches
      ORDER BY is_default DESC, updated_at DESC
      LIMIT 1
    `)
    .get() as LocalBranchRecord | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    isDefault: Boolean((row as unknown as { isDefault: number }).isDefault)
  };
};

export const saveCartDraft = (draft: {
  tenantId: string;
  branchId: string;
  deviceId: string;
  cashierUserId: string | null;
  payloadJson: string;
}) => {
  const db = getDatabase();
  const existing = getCartDraft(draft.tenantId, draft.branchId, draft.deviceId);
  const now = new Date().toISOString();
  const draftId = existing?.draftId ?? crypto.randomUUID();
  db.prepare(`
    INSERT INTO local_cart_drafts(
      draft_id,
      tenant_id,
      branch_id,
      device_id,
      cashier_user_id,
      payload_json,
      updated_at,
      created_at
    )
    VALUES(
      @draftId,
      @tenantId,
      @branchId,
      @deviceId,
      @cashierUserId,
      @payloadJson,
      @updatedAt,
      @createdAt
    )
    ON CONFLICT(draft_id) DO UPDATE SET
      cashier_user_id = excluded.cashier_user_id,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `).run({
    draftId,
    tenantId: draft.tenantId,
    branchId: draft.branchId,
    deviceId: draft.deviceId,
    cashierUserId: draft.cashierUserId,
    payloadJson: draft.payloadJson,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now
  });
};

export const getCartDraft = (tenantId: string, branchId: string, deviceId: string): CartDraftRecord | null => {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        draft_id AS draftId,
        tenant_id AS tenantId,
        branch_id AS branchId,
        device_id AS deviceId,
        cashier_user_id AS cashierUserId,
        payload_json AS payloadJson,
        updated_at AS updatedAt,
        created_at AS createdAt
      FROM local_cart_drafts
      WHERE tenant_id = @tenantId AND branch_id = @branchId AND device_id = @deviceId
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    .get({ tenantId, branchId, deviceId }) as CartDraftRecord | undefined;

  return row ?? null;
};

export const clearCartDraft = (tenantId: string, branchId: string, deviceId: string) => {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM local_cart_drafts
    WHERE tenant_id = @tenantId AND branch_id = @branchId AND device_id = @deviceId
  `).run({ tenantId, branchId, deviceId });
};

export const saveSyncState = (state: Omit<SyncStateRecord, "updatedAt">) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_state(
      sync_scope,
      pending_count,
      failed_count,
      sent_count,
      dead_letter_count,
      last_run_at,
      last_success_at,
      last_pull_at,
      last_heartbeat_at,
      connection_quality,
      blocked_reason,
      last_error,
      updated_at
    )
    VALUES(
      @syncScope,
      @pendingCount,
      @failedCount,
      @sentCount,
      @deadLetterCount,
      @lastRunAt,
      @lastSuccessAt,
      @lastPullAt,
      @lastHeartbeatAt,
      @connectionQuality,
      @blockedReason,
      @lastError,
      @updatedAt
    )
    ON CONFLICT(sync_scope) DO UPDATE SET
      pending_count = excluded.pending_count,
      failed_count = excluded.failed_count,
      sent_count = excluded.sent_count,
      dead_letter_count = excluded.dead_letter_count,
      last_run_at = excluded.last_run_at,
      last_success_at = excluded.last_success_at,
      last_pull_at = excluded.last_pull_at,
      last_heartbeat_at = excluded.last_heartbeat_at,
      connection_quality = excluded.connection_quality,
      blocked_reason = excluded.blocked_reason,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run({
    ...state,
    updatedAt: now
  });
};

export const appendLocalAuditLog = (entry: {
  tenantId?: string | null;
  branchId?: string | null;
  deviceId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  actionType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  eventType: string;
  message: string;
  metadata?: unknown;
  payload?: unknown;
  syncStatus?: string;
}) => {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO local_audit_logs(
      audit_log_id,
      tenant_id,
      branch_id,
      device_id,
      actor_user_id,
      actor_email,
      actor_name,
      action_type,
      entity_type,
      entity_id,
      metadata_json,
      sync_status,
      event_type,
      message,
      payload_json,
      created_at
    )
    VALUES(
      @auditLogId,
      @tenantId,
      @branchId,
      @deviceId,
      @actorUserId,
      @actorEmail,
      @actorName,
      @actionType,
      @entityType,
      @entityId,
      @metadataJson,
      @syncStatus,
      @eventType,
      @message,
      @payloadJson,
      @createdAt
    )
  `).run({
    auditLogId: crypto.randomUUID(),
    tenantId: entry.tenantId ?? null,
    branchId: entry.branchId ?? null,
    deviceId: entry.deviceId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorEmail: entry.actorEmail ?? null,
    actorName: entry.actorName ?? null,
    actionType: entry.actionType ?? entry.eventType,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
    syncStatus: entry.syncStatus ?? "PENDING",
    eventType: entry.eventType,
    message: entry.message,
    payloadJson: entry.payload ? JSON.stringify(entry.payload) : null,
    createdAt: new Date().toISOString()
  });
};

export const startLocalUserSession = (entry: {
  tenantId: string;
  branchId?: string | null;
  deviceId?: string | null;
  actorEmail: string;
  actorName: string;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO local_user_sessions(
      local_user_session_id,
      tenant_id,
      branch_id,
      device_id,
      actor_email,
      actor_name,
      started_at,
      ended_at,
      status,
      created_at,
      updated_at
    )
    VALUES(
      @localUserSessionId,
      @tenantId,
      @branchId,
      @deviceId,
      @actorEmail,
      @actorName,
      @startedAt,
      NULL,
      'active',
      @createdAt,
      @updatedAt
    )
  `).run({
    localUserSessionId: crypto.randomUUID(),
    tenantId: entry.tenantId,
    branchId: entry.branchId ?? null,
    deviceId: entry.deviceId ?? null,
    actorEmail: entry.actorEmail.toLowerCase(),
    actorName: entry.actorName,
    startedAt: now,
    createdAt: now,
    updatedAt: now
  });
};

export const endLocalUserSessions = (entry: {
  tenantId?: string | null;
  actorEmail: string;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE local_user_sessions
    SET
      ended_at = @endedAt,
      status = 'ended',
      updated_at = @updatedAt
    WHERE actor_email = @actorEmail
      AND status = 'active'
      AND (@tenantId IS NULL OR tenant_id = @tenantId)
  `).run({
    tenantId: entry.tenantId ?? null,
    actorEmail: entry.actorEmail.toLowerCase(),
    endedAt: now,
    updatedAt: now
  });
};

const upsertLocalUser = (user: {
  userId: string;
  tenantId: string | null;
  email: string;
  fullName: string;
  companyName: string | null;
  portalType: string;
  roles: string[];
  status: string;
  lastLoginAt: string;
}) => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO local_users(
      user_id,
      tenant_id,
      email,
      full_name,
      company_name,
      portal_type,
      roles_json,
      status,
      last_login_at,
      created_at,
      updated_at
    )
    VALUES(
      @userId,
      @tenantId,
      @email,
      @fullName,
      @companyName,
      @portalType,
      @rolesJson,
      @status,
      @lastLoginAt,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(user_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      email = excluded.email,
      full_name = excluded.full_name,
      company_name = excluded.company_name,
      portal_type = excluded.portal_type,
      roles_json = excluded.roles_json,
      status = excluded.status,
      last_login_at = excluded.last_login_at,
      updated_at = excluded.updated_at
  `).run({
    userId: user.userId,
    tenantId: user.tenantId,
    email: user.email.toLowerCase(),
    fullName: user.fullName,
    companyName: user.companyName,
    portalType: user.portalType,
    rolesJson: JSON.stringify(user.roles),
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: now,
    updatedAt: now
  });
};

const safeJsonArray = (value: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const protectSecret = (value: string) => {
  if (!value) {
    return value;
  }

  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(value).toString("base64")}`;
    }
  } catch {
    // fall back to plain storage marker
  }

  return `plain:${value}`;
};

const revealSecret = (value: string) => {
  if (!value) {
    return value;
  }

  if (value.startsWith("enc:")) {
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(4), "base64"));
    } catch {
      return "";
    }
  }

  return value.startsWith("plain:") ? value.slice(6) : value;
};
