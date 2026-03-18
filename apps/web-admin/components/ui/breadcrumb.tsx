import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({
  items,
  className
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={item.href ?? item.label + index} className="inline-flex items-center gap-2">
            {item.href && isLast === false ? (
              <Link href={item.href as never} className="text-text/70 transition hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-semibold text-text" : "text-text/70"}>{item.label}</span>
            )}
            {isLast ? null : <span className="text-text/40">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
