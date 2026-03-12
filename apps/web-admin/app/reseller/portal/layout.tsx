import type { ReactNode } from "react";
import { PortalGate } from "@/components/auth/portal-gate";
import { PortalShell } from "@/components/portal/portal-shell";
import { resellerPortalModules } from "@/lib/site-content";

export default function ResellerPortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGate requiredPortal="reseller">
      <PortalShell eyebrow="Reseller portal" title="Partner center" nav={resellerPortalModules}>
        {children}
      </PortalShell>
    </PortalGate>
  );
}
