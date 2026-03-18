"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackMarketingEvent } from "@/lib/marketing-service";

function getTrafficSource(searchParams: URLSearchParams, referrer: string) {
  const utmSource = searchParams.get("utm_source");
  if (utmSource) {
    return utmSource;
  }

  if (!referrer) {
    return undefined;
  }

  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

export function MarketingAnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    const query = searchParams.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    if (!nextPath || lastTracked.current === nextPath) {
      return;
    }

    const referrer = typeof document !== "undefined" ? document.referrer : "";

    lastTracked.current = nextPath;
    trackMarketingEvent({
      type: "page_view",
      path: nextPath,
      context: "page_view",
      source: getTrafficSource(searchParams, referrer),
      medium: searchParams.get("utm_medium") ?? undefined,
      campaign: searchParams.get("utm_campaign") ?? undefined,
      referrer: referrer || undefined
    });
  }, [pathname, searchParams]);

  return null;
}
