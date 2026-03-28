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

  if (internalHeader !== "true") {
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
