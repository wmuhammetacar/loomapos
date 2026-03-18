"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { MarketingAnalyticsProvider } from "@/components/site/marketing-analytics-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <MarketingAnalyticsProvider />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}
