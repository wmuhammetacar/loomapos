import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import ForbiddenPage from "@/app/forbidden";
import "./globals.css";

export const metadata: Metadata = {
  title: "Looma Control Center",
  description: "Internal operations panel"
};

export default async function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const internalHeader = requestHeaders.get("x-internal-admin");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = (forwardedHost ?? requestHeaders.get("host") ?? "").toLowerCase();
  const isLocalHost = host.startsWith("127.0.0.1") || host.startsWith("localhost");
  const allowLocalBypass =
    isLocalHost &&
    process.env.LOOMA_INTERNAL_ADMIN_REQUIRE_HEADER !== "true";

  if (internalHeader !== "true" && !allowLocalBypass) {
    return (
      <html lang="en">
        <body>
          <ForbiddenPage />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
