import Link from "next/link";
import { NewsletterSignupForm } from "@/components/forms/newsletter-signup-form";
import { footerNavGroups, marketingSiteConfig } from "@/lib/marketing-content";

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white/90">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="font-heading text-2xl font-bold text-text">{marketingSiteConfig.name}</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-text/70">
            The website is the growth and acquisition layer for LoomaPOS. It explains the
            product, drives subscriptions, supports downloads and routes visitors to the correct
            portal without ever acting like a live POS interface.
          </p>
          <div className="mt-5 space-y-2 text-sm text-text/70">
            <p>{marketingSiteConfig.salesEmail}</p>
            <p>{marketingSiteConfig.supportEmail}</p>
            <p>{marketingSiteConfig.phone}</p>
          </div>
          <NewsletterSignupForm />
        </div>
        {footerNavGroups.map((group) => (
          <div key={group.title}>
            <p className="font-heading text-lg font-semibold text-text">{group.title}</p>
            <div className="mt-4 grid gap-3 text-sm text-text/70">
              {group.links.map((item) => (
                <Link key={item.href} href={item.href as never} className="transition hover:text-text">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-text/55 md:flex-row md:items-center md:justify-between">
          <span>(c) 2026 {marketingSiteConfig.name}. All rights reserved.</span>
          <span>Marketing website, subscription hub, documentation, downloads and reseller growth surface.</span>
        </div>
      </div>
    </footer>
  );
}
