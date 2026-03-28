"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tenants", label: "Tenants" },
  { href: "/devices", label: "Devices" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/sync", label: "Sync Issues" },
  { href: "/support", label: "Support Notes" },
  { href: "/audit", label: "Audit Log" }
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-line bg-surface p-4">
          <div className="mb-6 rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Looma Internal</p>
            <p className="text-lg font-semibold text-brand">Control Center</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand text-white"
                      : "text-gray-700 hover:bg-muted hover:text-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Internal Operations Panel</p>
              <h1 className="text-sm font-semibold">Looma SaaS Control Surface</h1>
            </div>
            <p className="text-sm text-gray-600">Env: Internal</p>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
