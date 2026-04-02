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
  const pathname = requestHeaders.get("x-control-center-pathname") ?? "/";
  const isLoginRoute = pathname === "/login";

  if (isLoginRoute) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const adminEmail = requestHeaders.get("x-control-center-admin-email");
  const adminName = requestHeaders.get("x-control-center-admin-name") ?? undefined;
  const adminRoles = (requestHeaders.get("x-control-center-admin-roles") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (!adminEmail) {
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
        <AdminShell adminEmail={adminEmail} adminName={adminName} adminRoles={adminRoles}>
          {children}
        </AdminShell>
      </body>
    </html>
  );
}
