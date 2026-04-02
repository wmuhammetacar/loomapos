import { NextRequest, NextResponse } from "next/server";
import {
  getInternalApiBaseUrl,
  INTERNAL_ADMIN_ACCESS_COOKIE,
  INTERNAL_ADMIN_COOKIE_TTL_SECONDS,
  sanitizeReturnPath
} from "@/lib/internal-admin-auth";

type InternalAdminTokenEnvelopeDto = {
  accessToken: string;
  expiresAt?: string;
};

function redirectWithError(request: NextRequest, nextPath: string, error: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", sanitizeReturnPath(nextPath));
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeReturnPath(String(formData.get("next") ?? "/dashboard"));

  if (!email || !password) {
    return redirectWithError(request, nextPath, "missing_credentials");
  }

  try {
    const response = await fetch(`${getInternalApiBaseUrl()}/internal/admin/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return redirectWithError(request, nextPath, "login_failed");
    }

    const payload = (await response.json()) as InternalAdminTokenEnvelopeDto;
    if (!payload.accessToken || payload.accessToken.trim().length === 0) {
      return redirectWithError(request, nextPath, "invalid_login_response");
    }

    const redirectUrl = new URL(nextPath, request.url);
    const result = NextResponse.redirect(redirectUrl);
    result.cookies.set({
      name: INTERNAL_ADMIN_ACCESS_COOKIE,
      value: payload.accessToken.trim(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: INTERNAL_ADMIN_COOKIE_TTL_SECONDS
    });

    return result;
  } catch {
    return redirectWithError(request, nextPath, "login_unavailable");
  }
}
