import type { ReactNode } from "react";
import Link from "next/link";
import { SessionSummary } from "@/components/portal/session-summary";

interface PortalShellProps {
  eyebrow: string;
  title: string;
  nav: ReadonlyArray<{ href: string; label: string }>;
  children: ReactNode;
}

export function PortalShell({ eyebrow, title, nav, children }: PortalShellProps) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-[32px] border border-line bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] lg:sticky lg:top-6 lg:w-72 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-3xl text-text">{title}</h1>
          <nav className="mt-6 grid gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href as never}
                className="rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-text/70 transition hover:border-line hover:bg-muted hover:text-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-line bg-white px-6 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                Ticari Portal
              </p>
              <p className="mt-2 text-sm leading-6 text-text/68">
                Burasi sadece abonelik, lisans, indirme, faturalama ve cihaz metadata gorunumu
                sunar. Operasyonel POS islevleri burada yer almaz.
              </p>
            </div>
            <SessionSummary />
          </div>
          <div className="space-y-6">{children}</div>
        </section>
      </div>
    </div>
  );
}
