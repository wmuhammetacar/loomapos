export type AuthMode = "mock" | "oidc" | "portal";
export type PortalType = "customer" | "reseller" | "internal";

export interface AuthSession {
  mode: AuthMode;
  email: string;
  displayName: string;
  roles: string[];
  portalType?: PortalType;
  tenantId?: string;
  companyName?: string;
  resellerCode?: string;
  accessToken?: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
  expiresAt: number;
}

interface PendingOidcState {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
}

const SESSION_KEY = "loomapos_auth_session";
const OIDC_PENDING_KEY = "loomapos_oidc_pending";
const REFRESH_SKEW_MS = 60_000;
const PENDING_MAX_AGE_MS = 10 * 60_000;

const getRandomString = (length: number) => {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => charset[value % charset.length])
    .join("");
};

const base64UrlEncode = (input: ArrayBuffer): string => {
  const bytes = new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  return crypto.subtle.digest("SHA-256", data);
};

const decodeJwtPayload = <TPayload>(token: string): TPayload | null => {
  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) {
      return null;
    }
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as TPayload;
  } catch {
    return null;
  }
};

const nowMs = () => Date.now();

export const getAuthMode = (): AuthMode => {
  const value = process.env.NEXT_PUBLIC_AUTH_MODE?.toLowerCase();
  return value === "oidc" ? "oidc" : "mock";
};

const getApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export const getOidcAuthority = () =>
  process.env.NEXT_PUBLIC_OIDC_AUTHORITY ?? "http://localhost:8081/realms/loomapos";

export const getOidcClientId = () =>
  process.env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "loomapos-web-admin";

export const getOidcScope = () =>
  process.env.NEXT_PUBLIC_OIDC_SCOPE ?? "openid profile email offline_access";

export const getStoredSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.mode || !parsed?.email || !Number.isFinite(parsed?.expiresAt)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveSession = (session: AuthSession) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
};

export const isSessionValid = (session: AuthSession | null) =>
  Boolean(session && session.expiresAt > nowMs());

export const buildMockSession = (email: string): AuthSession => ({
  mode: "mock",
  email,
  displayName: email,
  roles: ["tenant_admin"],
  portalType: "customer",
  expiresAt: nowMs() + 12 * 60 * 60 * 1000
});

interface CustomerSessionInput {
  email: string;
  displayName: string;
  tenantId?: string;
  companyName?: string;
}

interface ResellerSessionInput {
  email: string;
  displayName: string;
  resellerCode: string;
}

interface InternalAdminSessionInput {
  email: string;
  displayName: string;
  roles: string[];
}

interface PortalSessionInput {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | number | Date;
  refreshExpiresAt?: string | number | Date;
  portalType: PortalType;
  roles: string[];
  email: string;
  displayName: string;
  tenantId?: string;
  companyName?: string;
  resellerCode?: string;
}

const parseSessionTimestamp = (value: string | number | Date | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildCustomerSession = ({
  email,
  displayName,
  tenantId,
  companyName
}: CustomerSessionInput): AuthSession => ({
  mode: "mock",
  email,
  displayName,
  roles: ["customer_portal"],
  portalType: "customer",
  tenantId,
  companyName,
  expiresAt: nowMs() + 12 * 60 * 60 * 1000
});

export const buildResellerSession = ({
  email,
  displayName,
  resellerCode
}: ResellerSessionInput): AuthSession => ({
  mode: "mock",
  email,
  displayName,
  roles: ["reseller_portal"],
  portalType: "reseller",
  resellerCode,
  expiresAt: nowMs() + 12 * 60 * 60 * 1000
});

export const buildInternalAdminSession = ({
  email,
  displayName,
  roles
}: InternalAdminSessionInput): AuthSession => ({
  mode: "mock",
  email,
  displayName,
  roles,
  portalType: "internal",
  expiresAt: nowMs() + 12 * 60 * 60 * 1000
});

export const buildPortalSession = ({
  accessToken,
  refreshToken,
  expiresAt,
  refreshExpiresAt,
  portalType,
  roles,
  email,
  displayName,
  tenantId,
  companyName,
  resellerCode
}: PortalSessionInput): AuthSession => ({
  mode: "portal",
  email,
  displayName,
  roles,
  portalType,
  tenantId,
  companyName,
  resellerCode,
  accessToken,
  refreshToken,
  expiresAt: parseSessionTimestamp(expiresAt) ?? nowMs() + 12 * 60 * 60 * 1000,
  refreshExpiresAt: parseSessionTimestamp(refreshExpiresAt)
});

const getRedirectUri = () =>
  process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ??
  `${window.location.origin}/auth/callback`;

const readPendingState = (): PendingOidcState | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(OIDC_PENDING_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PendingOidcState;
    if (!parsed?.state || !parsed?.verifier || !parsed?.returnTo) {
      return null;
    }
    if (nowMs() - parsed.createdAt > PENDING_MAX_AGE_MS) {
      window.sessionStorage.removeItem(OIDC_PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(OIDC_PENDING_KEY);
    return null;
  }
};

const writePendingState = (pending: PendingOidcState) => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(OIDC_PENDING_KEY, JSON.stringify(pending));
};

const clearPendingState = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(OIDC_PENDING_KEY);
};

export const startOidcLogin = async (returnTo: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const state = getRandomString(48);
  const verifier = getRandomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));

  writePendingState({
    state,
    verifier,
    returnTo: returnTo.startsWith("/") ? returnTo : "/",
    createdAt: nowMs()
  });

  const authority = getOidcAuthority();
  const params = new URLSearchParams({
    client_id: getOidcClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: getOidcScope(),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  window.location.assign(`${authority}/protocol/openid-connect/auth?${params.toString()}`);
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface AccessTokenClaims {
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: {
    roles?: string[];
  };
}

export const completeOidcCallback = async (code: string, state: string) => {
  const pending = readPendingState();
  if (!pending) {
    throw new Error("OIDC oturum verisi bulunamadi. Yeniden giris yapin.");
  }
  if (pending.state !== state) {
    clearPendingState();
    throw new Error("OIDC state dogrulamasi basarisiz.");
  }

  const tokenEndpoint = `${getOidcAuthority()}/protocol/openid-connect/token`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getOidcClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: pending.verifier
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OIDC token degisimi basarisiz: ${response.status} ${detail}`);
  }

  const token = (await response.json()) as TokenResponse;
  const claims = decodeJwtPayload<AccessTokenClaims>(token.access_token);
  const email = claims?.email ?? claims?.preferred_username ?? "kullanici@local";
  const displayName = claims?.name ?? email;
  const roles = claims?.realm_access?.roles ?? [];

  const session: AuthSession = {
    mode: "oidc",
    email,
    displayName,
    roles,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: nowMs() + token.expires_in * 1000
  };
  saveSession(session);
  clearPendingState();
  return pending.returnTo;
};

const refreshOidcSession = async (session: AuthSession): Promise<AuthSession | null> => {
  if (!session.refreshToken) {
    return null;
  }

  const tokenEndpoint = `${getOidcAuthority()}/protocol/openid-connect/token`;
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getOidcClientId(),
    refresh_token: session.refreshToken
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  if (!response.ok) {
    return null;
  }

  const token = (await response.json()) as TokenResponse;
  const claims = decodeJwtPayload<AccessTokenClaims>(token.access_token);

  const refreshed: AuthSession = {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? session.refreshToken,
    email: claims?.email ?? claims?.preferred_username ?? session.email,
    displayName: claims?.name ?? session.displayName,
    roles: claims?.realm_access?.roles ?? session.roles,
    expiresAt: nowMs() + token.expires_in * 1000
  };

  saveSession(refreshed);
  return refreshed;
};

const refreshPortalSession = async (session: AuthSession): Promise<AuthSession | null> => {
  if (!session.refreshToken || !session.portalType) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/commerce/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: session.refreshToken
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    refreshExpiresAt: string;
    portalType: PortalType;
    roles: string[];
    email: string;
    displayName: string;
    tenantId?: string | null;
    companyName?: string | null;
    resellerCode?: string | null;
  };

  const refreshed = buildPortalSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresAt: payload.expiresAt,
    refreshExpiresAt: payload.refreshExpiresAt,
    portalType: payload.portalType,
    roles: payload.roles,
    email: payload.email,
    displayName: payload.displayName,
    tenantId: payload.tenantId ?? undefined,
    companyName: payload.companyName ?? undefined,
    resellerCode: payload.resellerCode ?? undefined
  });

  saveSession(refreshed);
  return refreshed;
};

export const getValidSession = async (): Promise<AuthSession | null> => {
  const session = getStoredSession();
  if (!session) {
    return null;
  }

  if (session.mode === "mock" || session.mode === "portal") {
    if (session.mode === "portal" && session.expiresAt <= nowMs() + REFRESH_SKEW_MS) {
      const refreshed = await refreshPortalSession(session);
      if (refreshed) {
        return refreshed;
      }
    }

    if (!isSessionValid(session)) {
      clearSession();
      return null;
    }
    return session;
  }

  if (session.expiresAt > nowMs() + REFRESH_SKEW_MS) {
    return session;
  }

  const refreshed = await refreshOidcSession(session);
  if (refreshed) {
    return refreshed;
  }

  clearSession();
  return null;
};

export const logout = () => {
  const session = getStoredSession();
  clearSession();

  if (typeof window === "undefined") {
    return;
  }

  if (session?.mode === "portal" && session.accessToken) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
    const logoutPath = session.portalType === "internal" ? "/internal/admin/auth/logout" : "/commerce/auth/logout";
    void fetch(`${apiBaseUrl}${logoutPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`
      }
    }).catch(() => undefined);
  }

  if (session?.mode === "oidc") {
    const redirectUri = process.env.NEXT_PUBLIC_OIDC_LOGOUT_REDIRECT_URI ?? `${window.location.origin}/login`;
    const params = new URLSearchParams({
      post_logout_redirect_uri: redirectUri,
      client_id: getOidcClientId()
    });
    window.location.assign(`${getOidcAuthority()}/protocol/openid-connect/logout?${params.toString()}`);
    return;
  }

  window.location.assign(session?.portalType === "reseller" ? "/reseller/login" : "/login");
};
