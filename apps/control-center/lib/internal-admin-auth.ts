export const INTERNAL_ADMIN_ACCESS_COOKIE = "looma_internal_admin_access_token";
export const INTERNAL_ADMIN_COOKIE_TTL_SECONDS = 60 * 60 * 12;

const KNOWN_INTERNAL_ADMIN_ROLES = new Set([
  "super_admin",
  "ops_admin",
  "support_agent",
  "security_auditor",
  "release_manager",
  "read_only_analyst",
  "billing_admin",
  "reseller_manager"
]);

const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000";
const REQUEST_TIMEOUT_MS = 8000;

type InternalAdminMeDto = {
  email: string;
  displayName: string;
  roles: string[];
};

export type InternalAdminAccessValidation =
  | {
      ok: true;
      email: string;
      displayName: string;
      roles: string[];
    }
  | {
      ok: false;
      status: number;
      reason: string;
    };

export function getInternalApiBaseUrl(): string {
  return process.env.LOOMA_DOTNET_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function normalizeRole(role: string): string {
  return role.trim().replaceAll("-", "_").toLowerCase();
}

export function hasKnownInternalRole(roles: string[]): boolean {
  for (const role of roles) {
    if (KNOWN_INTERNAL_ADMIN_ROLES.has(normalizeRole(role))) {
      return true;
    }
  }

  return false;
}

export function sanitizeReturnPath(value: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/login") || trimmed.startsWith("/logout")) {
    return fallback;
  }

  return trimmed;
}

export async function verifyInternalAdminAccessToken(token: string): Promise<InternalAdminAccessValidation> {
  const trimmedToken = token.trim();
  if (trimmedToken.length === 0) {
    return {
      ok: false,
      status: 401,
      reason: "missing_token"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/internal/admin/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmedToken}`
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        reason: response.status === 401 ? "invalid_or_expired_token" : "auth_me_request_failed"
      };
    }

    const payload = (await response.json()) as InternalAdminMeDto;
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((item): item is string => typeof item === "string") : [];

    if (!hasKnownInternalRole(roles)) {
      return {
        ok: false,
        status: 403,
        reason: "role_not_allowed"
      };
    }

    return {
      ok: true,
      email: payload.email,
      displayName: payload.displayName,
      roles
    };
  } catch {
    return {
      ok: false,
      status: 503,
      reason: "auth_validation_unavailable"
    };
  } finally {
    clearTimeout(timeout);
  }
}
