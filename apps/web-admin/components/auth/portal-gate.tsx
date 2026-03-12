"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getValidSession, type PortalType } from "@/lib/auth";

interface PortalGateProps {
  requiredPortal: PortalType;
  children: ReactNode;
}

export function PortalGate({ requiredPortal, children }: PortalGateProps) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const session = await getValidSession();
      if (!mounted) {
        return;
      }

      if (!session || session.portalType !== requiredPortal) {
        const target =
          requiredPortal === "reseller"
            ? `/reseller/login?return_to=${encodeURIComponent(pathname)}`
            : `/login?return_to=${encodeURIComponent(pathname)}`;
        window.location.assign(target);
        return;
      }

      setReady(true);
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [pathname, requiredPortal]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-text/65">
        Portal oturumu dogrulaniyor...
      </div>
    );
  }

  return <>{children}</>;
}
