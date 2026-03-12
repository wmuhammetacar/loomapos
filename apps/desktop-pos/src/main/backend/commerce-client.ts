export interface CommercePortalAuthEnvelope {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
  portalType: "customer" | "reseller";
  roles: string[];
  email: string;
  displayName: string;
  tenantId?: string | null;
  companyName?: string | null;
  resellerCode?: string | null;
}

export interface CommercePortalCompanyDto {
  id: string;
  companyName: string;
  tenantCode: string;
  billingEmail: string;
  taxOffice?: string | null;
  taxNumber?: string | null;
  country: string;
  locale: string;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  status: string;
}

export interface CommercePortalLicenseDto {
  id: string;
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  licenseKey: string;
  licenseToken: string;
  signature: string;
  featuresJson: string;
  deviceLimit?: number | null;
  issuedAt: string;
  expiresAt: string;
  graceDays: number;
  status: string;
  createdAt: string;
}

export interface CommerceCatalogProductDto {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  taxRate: number;
  price: number;
  isActive: boolean;
  updatedAt?: string | null;
}

export interface CommerceDeviceActivationDto {
  id: string;
  tenantId: string;
  licenseId?: string | null;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion?: string | null;
  activationSource?: string | null;
  status: string;
  activatedAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
  updatedAt?: string | null;
}

const normalizeApiBase = () => {
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
      // ignore invalid env and fall back
    }
  }

  return "http://localhost:5000";
};

export const getCommerceApiBase = () => normalizeApiBase();

export const checkBackendReachability = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${normalizeApiBase()}/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
};

export const postCommerceJson = async <TResponse>(
  path: string,
  body: unknown,
  options?: {
    accessToken?: string | null;
  }
): Promise<TResponse> => {
  const headers = new Headers({
    "Content-Type": "application/json"
  });
  if (options?.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${normalizeApiBase()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  return (await response.json()) as TResponse;
};

export const getCommerceJson = async <TResponse>(
  path: string,
  options?: {
    accessToken?: string | null;
    headers?: Record<string, string>;
  }
): Promise<TResponse> => {
  const headers = new Headers(options?.headers ?? undefined);
  if (options?.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${normalizeApiBase()}${path}`, {
    method: "GET",
    headers
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  return (await response.json()) as TResponse;
};

export const postCommerceWithoutBody = async <TResponse>(
  path: string,
  options?: {
    accessToken?: string | null;
  }
): Promise<TResponse> => {
  const headers = new Headers();
  if (options?.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${normalizeApiBase()}${path}`, {
    method: "POST",
    headers
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  return (await response.json()) as TResponse;
};

const toErrorMessage = async (response: Response) => {
  const body = await response.text();
  return body.trim().length > 0 ? `API ${response.status}: ${body}` : `API ${response.status}`;
};
