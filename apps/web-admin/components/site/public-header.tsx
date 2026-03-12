import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { globalCtas, mainNav, siteConfig } from "@/lib/site-content";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-[rgba(251,247,242,0.85)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-heading text-2xl font-bold tracking-tight text-text">
            {siteConfig.name}
          </Link>
          <span className="hidden rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand lg:inline-flex">
            Sales + licensing hub
          </span>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-text/70 lg:flex">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href as never} className="transition hover:text-text">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={globalCtas[0].href as never}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {globalCtas[0].label}
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Login
          </Link>
          <Link
            href={globalCtas[3].href as never}
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            Buy Now
          </Link>
        </div>
      </div>
    </header>
  );
}
