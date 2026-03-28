"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { marketingSiteConfig } from "@/lib/marketing-content";
import { trackMarketingEvent } from "@/lib/marketing-service";

const headerNav = [
  { href: "/features", label: "Ozellikler" },
  { href: "/pricing", label: "Fiyatlar" },
  { href: "/download", label: "Indir" },
  { href: "/login", label: "Giris" }
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-50 border-b border-line bg-[rgba(251,247,242,0.9)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-text">
          {marketingSiteConfig.name}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-text/75 lg:flex">
          {headerNav.map((item) => (
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

        <div className="hidden md:flex">
          <Link
            href="/register"
            className={buttonVariants({ variant: "primary", size: "sm" })}
            onClick={() =>
              trackHeaderClick("Ucretsiz Deneme Baslat", "/register", "header_primary")
            }
          >
            Ucretsiz Deneme
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
            {headerNav.map((item) => (
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

          <div className="mt-4">
            <Link
              href="/register"
              className={buttonVariants({ variant: "primary", size: "md" })}
              onClick={() => {
                setIsMenuOpen(false);
                trackHeaderClick("Ucretsiz Deneme Baslat", "/register", "mobile_header_primary");
              }}
            >
              Ucretsiz Deneme Baslat
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
