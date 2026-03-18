"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getStoredSession, type AuthSession } from "@/lib/auth";
import {
  marketingPrimaryCtas,
  publicHeaderNav,
  marketingSiteConfig
} from "@/lib/marketing-content";
import { trackMarketingEvent } from "@/lib/marketing-service";

export function PublicHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getStoredSession());
  }, [pathname]);

  const portalLink =
    session?.portalType === "reseller"
      ? { href: "/reseller/portal", label: "Partner Portal" }
      : session?.portalType === "customer"
        ? { href: "/portal", label: "Customer Portal" }
        : null;

  function trackHeaderClick(label: string, href: string, context: string) {
    trackMarketingEvent({
      type: "cta_click",
      path: pathname,
      label,
      href,
      context
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[rgba(251,247,242,0.85)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-text">
            {marketingSiteConfig.name}
          </Link>
          <span className="hidden rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand lg:inline-flex">
            SEO + conversion engine
          </span>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-text/70 lg:flex">
          {publicHeaderNav.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className="transition hover:text-text"
              onClick={() => trackHeaderClick(item.label, item.href, "header_nav")}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/demo"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            onClick={() => trackHeaderClick("Request Demo", "/demo", "header_demo")}
          >
            Request Demo
          </Link>
          {portalLink ? (
            <Link
              href={portalLink.href as never}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => trackHeaderClick(portalLink.label, portalLink.href, "header_portal")}
            >
              {portalLink.label}
            </Link>
          ) : (
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => trackHeaderClick("Login", "/login", "header_login")}
            >
              Login
            </Link>
          )}
          <Link
            href={marketingPrimaryCtas[0].href as never}
            className={buttonVariants({ variant: "primary", size: "sm" })}
            onClick={() =>
              trackHeaderClick(
                marketingPrimaryCtas[0].label,
                marketingPrimaryCtas[0].href,
                "header_primary"
              )
            }
          >
            {marketingPrimaryCtas[0].label}
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text lg:hidden"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          Menu
        </button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-line bg-white/95 px-6 py-5 lg:hidden">
          <nav className="grid gap-3 text-sm font-medium text-text/75">
            {publicHeaderNav.map((item) => (
              <Link
                key={item.href}
                href={item.href as never}
                className="rounded-2xl border border-line bg-muted/30 px-4 py-3 transition hover:text-text"
                onClick={() => {
                  setIsMenuOpen(false);
                  trackHeaderClick(item.label, item.href, "mobile_header_nav");
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid gap-3">
            <Link
              href="/demo"
              className={buttonVariants({ variant: "ghost", size: "md" })}
              onClick={() => {
                setIsMenuOpen(false);
                trackHeaderClick("Request Demo", "/demo", "mobile_header_demo");
              }}
            >
              Request Demo
            </Link>
            <Link
              href={(portalLink?.href ?? "/login") as never}
              className={buttonVariants({ variant: "outline", size: "md" })}
              onClick={() => {
                setIsMenuOpen(false);
                trackHeaderClick(
                  portalLink?.label ?? "Login",
                  portalLink?.href ?? "/login",
                  "mobile_header_portal"
                );
              }}
            >
              {portalLink?.label ?? "Login"}
            </Link>
            <Link
              href={marketingPrimaryCtas[0].href as never}
              className={buttonVariants({ variant: "primary", size: "md" })}
              onClick={() => {
                setIsMenuOpen(false);
                trackHeaderClick(
                  marketingPrimaryCtas[0].label,
                  marketingPrimaryCtas[0].href,
                  "mobile_header_primary"
                );
              }}
            >
              {marketingPrimaryCtas[0].label}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
