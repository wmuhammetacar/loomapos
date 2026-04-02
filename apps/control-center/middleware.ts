import { NextResponse, type NextRequest } from "next/server";
import {
  INTERNAL_ADMIN_ACCESS_COOKIE,
  sanitizeReturnPath,
  verifyInternalAdminAccessToken
} from "@/lib/internal-admin-auth";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/logout" || pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function withPathHeader(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-control-center-pathname", request.nextUrl.pathname);
  return requestHeaders;
}

function deniedLog(input: {
  request: NextRequest;
  reason: string;
  actor?: string;
}) {
  const requestId = input.request.headers.get("x-request-id") ?? input.request.headers.get("x-correlation-id") ?? "unknown";

  console.warn(
    JSON.stringify({
      event: "control_center_access_denied",
      path: input.request.nextUrl.pathname,
      method: input.request.method,
      actor: input.actor ?? "anonymous",
      reason: input.reason,
      requestId
    })
  );
}

function redirectToLogin(request: NextRequest, reason: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", sanitizeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
  loginUrl.searchParams.set("reason", reason);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(INTERNAL_ADMIN_ACCESS_COOKIE);
  return response;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = withPathHeader(request);

  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  }

  const token = request.cookies.get(INTERNAL_ADMIN_ACCESS_COOKIE)?.value;
  if (!token) {
    deniedLog({ request, reason: "missing_internal_session" });
    return redirectToLogin(request, "missing_internal_session");
  }

  const validation = await verifyInternalAdminAccessToken(token);
  if (!validation.ok) {
    deniedLog({ request, reason: validation.reason });
    return redirectToLogin(request, validation.reason);
  }

  requestHeaders.set("x-control-center-admin-email", validation.email);
  requestHeaders.set("x-control-center-admin-name", validation.displayName);
  requestHeaders.set("x-control-center-admin-roles", validation.roles.join(","));

  return NextResponse.next({
    request: { headers: requestHeaders }
  });
}

export const config = {
  matcher: ["/(.*)"]
};
