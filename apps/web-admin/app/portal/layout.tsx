import type { ReactNode } from "react";
import { PortalGate } from "@/components/auth/portal-gate";
import { PortalShell } from "@/components/portal/portal-shell";
import { portalModules } from "@/lib/site-content";

export default function CustomerPortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGate requiredPortal="customer">
      <PortalShell eyebrow="Customer portal" title="Account center" nav={portalModules}>
        {children}
      </PortalShell>
    </PortalGate>
  );
}
