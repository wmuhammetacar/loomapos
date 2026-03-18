import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const marketingTopNav = [
  { label: "Features", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "Download", href: "/download" },
  { label: "Resellers", href: "/resellers" },
  { label: "Docs", href: "/docs" }
] as const;

export const customerPortalNav = [
  { label: "Overview", href: "/portal" },
  { label: "Onboarding", href: "/portal/onboarding" },
  { label: "Subscription", href: "/portal/subscription" },
  { label: "Licenses", href: "/portal/licenses" },
  { label: "Devices", href: "/portal/devices" },
  { label: "Billing", href: "/portal/billing" },
  { label: "Downloads", href: "/portal/downloads" },
  { label: "Support", href: "/portal/support" }
] as const;

export const resellerPortalNav = [
  { label: "Overview", href: "/reseller/portal" },
  { label: "Onboarding", href: "/reseller/portal/onboarding" },
  { label: "Customers", href: "/reseller/portal/customers" },
  { label: "Referrals", href: "/reseller/portal/referrals" },
  { label: "Commissions", href: "/reseller/portal/commissions" },
  { label: "Payouts", href: "/reseller/portal/payouts" },
  { label: "Assets", href: "/reseller/portal/assets" },
  { label: "Support", href: "/reseller/portal/support" }
] as const;

export const mobileBottomNav = [
  { label: "Dashboard", id: "dashboard" },
  { label: "Sales", id: "sales" },
  { label: "Products", id: "products" },
  { label: "Reports", id: "reports" },
  { label: "Settings", id: "settings" }
] as const;

export function PortalSidebarPattern({
  title,
  items,
  activeHref
}: {
  title: string;
  items: ReadonlyArray<{ label: string; href: string }>;
  activeHref: string;
}) {
  return (
    <aside className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">{title}</p>
      <nav className="mt-3 grid gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href as never}
            className={cn(
              "rounded-xl px-3 py-2 text-sm transition",
              item.href === activeHref
                ? "bg-brand text-white"
                : "border border-transparent text-text/75 hover:border-line hover:bg-muted/40"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function MobileBottomNavPattern({
  active,
  onSelect
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface/95 px-3 pb-2 pt-2 backdrop-blur tablet:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
        {mobileBottomNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-semibold transition",
              item.id === active ? "bg-brand text-white" : "text-text/65 hover:bg-muted"
            )}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function DesktopTaskHeaderPattern({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="font-heading text-2xl text-text">{title}</h1>
        <p className="text-sm text-text/70">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
