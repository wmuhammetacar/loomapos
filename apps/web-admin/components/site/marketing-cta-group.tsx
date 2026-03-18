"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { MarketingCtaItem } from "@/lib/marketing-content";
import { trackMarketingEvent } from "@/lib/marketing-service";

interface MarketingCtaGroupProps {
  items: readonly MarketingCtaItem[];
  context: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MarketingCtaGroup({
  items,
  context,
  size = "lg",
  className
}: MarketingCtaGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {items.map((item) => (
        <Link
          key={`${context}-${item.href}-${item.label}`}
          href={item.href as never}
          className={buttonVariants({
            variant: item.variant,
            size
          })}
          onClick={() =>
            trackMarketingEvent({
              type: "cta_click",
              path: typeof window !== "undefined" ? window.location.pathname : undefined,
              label: item.label,
              href: item.href,
              context
            })
          }
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
