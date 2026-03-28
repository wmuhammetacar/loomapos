import Link from "next/link";
import { marketingSiteConfig } from "@/lib/marketing-content";

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Anasayfa" },
      { href: "/features", label: "Ozellikler" },
      { href: "/pricing", label: "Fiyatlar" }
    ]
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Dokumantasyon" },
      { href: "/faq", label: "SSS" },
      { href: "/blog", label: "Blog" }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "Hakkimizda" },
      { href: "/contact", label: "Iletisim" },
      { href: "/status", label: "Durum" }
    ]
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Kullanim Kosullari" },
      { href: "/legal/privacy", label: "Gizlilik" },
      { href: "/legal/cookies", label: "Cerezler" }
    ]
  },
  {
    title: "Downloads",
    links: [
      { href: "/download#windows", label: "Windows" },
      { href: "/download#android", label: "Android" },
      { href: "/download", label: "Indirme Merkezi" }
    ]
  },
  {
    title: "Portal",
    links: [
      { href: "/login", label: "Musteri Girisi" },
      { href: "/reseller/login", label: "Bayi Girisi" },
      { href: "/portal", label: "Musteri Portali" }
    ]
  }
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-white/90">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3 xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="font-heading text-2xl font-bold text-text">{marketingSiteConfig.name}</p>
          <p className="mt-3 text-sm leading-7 text-text/70">
            LoomaPOS web katmani urun tanitimi, fiyatlandirma, indirme ve lisans yonetimi icindir.
            Canli satis operasyonu Desktop ve Mobile uygulamada calisir.
          </p>
          <div className="mt-5 space-y-2 text-sm text-text/70">
            <p>{marketingSiteConfig.salesEmail}</p>
            <p>{marketingSiteConfig.supportEmail}</p>
            <p>{marketingSiteConfig.phone}</p>
          </div>
        </div>

        {footerGroups.map((group) => (
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
          <span>(c) 2026 {marketingSiteConfig.name}. Tum haklari saklidir.</span>
          <span>Web tanitim ve yonetim katmani | Operasyon: Desktop + Mobile</span>
        </div>
      </div>
    </footer>
  );
}
