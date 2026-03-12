"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { adminModules } from "@/lib/site-content";
import { getValidSession, logout, type AuthSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AdminShellProps {
  title: string;
  eyebrow: string;
  children: ReactNode;
}

export function AdminShell({ title, eyebrow, children }: AdminShellProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    void getValidSession().then(setSession);
  }, []);

  const isInternal = session?.portalType === "internal";
  const isLoginPage = pathname === "/admin/login";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6 xl:flex-row">
        <aside className="w-full shrink-0 rounded-[32px] border border-line bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] xl:sticky xl:top-6 xl:w-80 xl:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">{eyebrow}</p>
          <h1 className="mt-3 font-heading text-3xl text-text">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-text/68">
            Internal operations console for support, billing, reseller oversight, release control and observability.
          </p>
          <nav className="mt-6 grid gap-2">
            {adminModules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-text/70 transition hover:border-line hover:bg-muted hover:text-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <Card className="flex flex-col gap-4 rounded-[32px] border border-line bg-white px-6 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Internal admin</p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                Sensitive actions require role checks, reason entry and audit logging. This surface never runs store POS workflows.
              </p>
            </div>
            {isInternal ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-line px-4 py-2 text-sm text-text/72">
                  {session.displayName} - {session.roles.join(", ")}
                </div>
                <Button variant="outline" onClick={() => logout()}>
                  Logout
                </Button>
              </div>
            ) : (
              <Link href="/admin/login" className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">
                Admin sign in
              </Link>
            )}
          </Card>

          {isInternal || isLoginPage ? (
            children
          ) : (
            <Card>
              <h2 className="font-heading text-2xl text-text">Internal access required</h2>
              <p className="mt-3 text-sm leading-6 text-text/68">
                Sign in with an internal admin session before opening tenant, billing, support or observability surfaces.
              </p>
              <Link href="/admin/login" className="mt-6 inline-block rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">
                Go to admin login
              </Link>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
