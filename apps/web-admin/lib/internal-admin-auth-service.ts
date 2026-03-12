import { commerceFetch, type PortalAuthResponseDto } from "@/lib/api-client";
import { buildPortalSession, saveSession } from "@/lib/auth";

export async function loginInternalAdmin(email: string, password: string) {
  const response = await commerceFetch<PortalAuthResponseDto>("/internal/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  saveSession(
    buildPortalSession({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt,
      refreshExpiresAt: response.refreshExpiresAt,
      portalType: "internal",
      roles: response.roles,
      email: response.email,
      displayName: response.displayName
    })
  );

  return response;
}
