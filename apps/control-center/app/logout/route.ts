import { NextRequest, NextResponse } from "next/server";
import {
  getInternalApiBaseUrl,
  INTERNAL_ADMIN_ACCESS_COOKIE
} from "@/lib/internal-admin-auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(INTERNAL_ADMIN_ACCESS_COOKIE)?.value?.trim();

  if (token) {
    try {
      await fetch(`${getInternalApiBaseUrl()}/internal/admin/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });
    } catch {
      // best-effort logout
    }
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("reason", "signed_out");

  const response = NextResponse.redirect(url);
  response.cookies.delete(INTERNAL_ADMIN_ACCESS_COOKIE);
  return response;
}
