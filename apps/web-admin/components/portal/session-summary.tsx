"use client";

import { useEffect, useState } from "react";
import { getStoredSession, logout } from "@/lib/auth";

export function SessionSummary() {
  const [identity, setIdentity] = useState<{
    displayName: string;
    email: string;
    companyName?: string;
    resellerCode?: string;
  } | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      return;
    }
    setIdentity({
      displayName: session.displayName,
      email: session.email,
      companyName: session.companyName,
      resellerCode: session.resellerCode
    });
  }, []);

  if (!identity) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-semibold text-text">{identity.displayName}</p>
        <p className="text-xs text-text/60">
          {identity.companyName ?? identity.resellerCode ?? identity.email}
        </p>
      </div>
      <button
        type="button"
        onClick={logout}
        className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-text/70 transition hover:border-brand hover:text-brand"
      >
        Cikis
      </button>
    </div>
  );
}
