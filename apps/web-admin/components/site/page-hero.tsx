import type { ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CtaItem } from "@/lib/site-content";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: CtaItem[];
  aside?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions = [],
  aside
}: PageHeroProps) {
  return (
    <section className="grain-overlay relative overflow-hidden rounded-[36px] border border-line bg-white px-6 py-8 shadow-brand md:px-10 md:py-10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-warning to-accent" />
      <div className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[1.45fr_0.75fr] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-tight text-text md:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-text/75">{description}</p>
          {actions.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href as never}
                  className={buttonVariants({
                    variant: action.variant,
                    size: "lg"
                  })}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
        {aside ? (
          <div className="rounded-[28px] border border-line bg-slate-950 px-6 py-6 text-white">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
