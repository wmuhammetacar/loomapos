import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site-content";

const legalLinks = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/kvkk", label: "KVKK" },
  { href: "/legal/cookies", label: "Cookies" }
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white/90">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <p className="font-heading text-2xl font-bold text-text">{siteConfig.name}</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-text/70">
            Web katmani sadece tanitim, abonelik satisi, lisans dagitimi, indirme ve hesap
            yonetimi icindir. Tum gercek POS operasyonlari Desktop ve Mobile uygulamalarda
            calisir.
          </p>
        </div>

        <div>
          <p className="font-heading text-lg font-semibold text-text">Platform</p>
          <div className="mt-4 grid gap-3 text-sm text-text/70">
            {mainNav.map((item) => (
              <Link key={item.href} href={item.href as never} className="transition hover:text-text">
                {item.label}
              </Link>
            ))}
            <Link href="/contact" className="transition hover:text-text">
              Contact
            </Link>
            <Link href="/about" className="transition hover:text-text">
              About
            </Link>
          </div>
        </div>

        <div>
          <p className="font-heading text-lg font-semibold text-text">Legal</p>
          <div className="mt-4 grid gap-3 text-sm text-text/70">
            {legalLinks.map((item) => (
              <Link key={item.href} href={item.href as never} className="transition hover:text-text">
                {item.label}
              </Link>
            ))}
            <p>{siteConfig.supportEmail}</p>
            <p>{siteConfig.phone}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-text/55 md:flex-row md:items-center md:justify-between">
          <span>(c) 2026 {siteConfig.name}. Tum haklari saklidir.</span>
          <span>Commercial website, subscription hub, reseller acquisition, licensing center.</span>
        </div>
      </div>
    </footer>
  );
}
