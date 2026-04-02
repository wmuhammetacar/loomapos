"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navSections = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/tenants", label: "Tenants" },
      { href: "/devices", label: "Devices" },
      { href: "/subscriptions", label: "Subscriptions" },
      { href: "/sync", label: "Sync Issues" },
      { href: "/support", label: "Support Notes" },
      { href: "/audit", label: "Audit Log" }
    ]
  },
  {
    title: "ERP",
    items: [
      { href: "/erp/warehouses", label: "Warehouses" },
      { href: "/erp/transfers", label: "Transfers" },
      { href: "/erp/suppliers", label: "Suppliers" },
      { href: "/erp/purchase-orders", label: "Purchase Orders" },
      { href: "/erp/customer-accounts", label: "Customer Accounts" },
      { href: "/erp/accounting-exports", label: "Accounting Exports" }
    ]
  }
] as const;

type AdminShellProps = {
  children: ReactNode;
  adminEmail: string;
  adminName?: string;
  adminRoles: string[];
};

export function AdminShell({ children, adminEmail, adminName, adminRoles }: AdminShellProps) {
  const pathname = usePathname();
  const roleLabel = adminRoles.length > 0 ? adminRoles.join(", ") : "internal_admin";

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-line bg-surface p-4">
          <div className="mb-6 rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Looma Internal</p>
            <p className="text-lg font-semibold text-brand">Control Center</p>
          </div>
          <nav className="space-y-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {section.title}
                </p>
                {section.items.map((item) => {
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
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Internal Operations Panel</p>
              <h1 className="text-sm font-semibold">Looma SaaS Control Surface</h1>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <p className="font-medium text-text">{adminName ?? adminEmail}</p>
                <p className="text-xs text-gray-500">{roleLabel}</p>
              </div>
              <Link
                href="/logout"
                className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-muted"
              >
                Sign out
              </Link>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
