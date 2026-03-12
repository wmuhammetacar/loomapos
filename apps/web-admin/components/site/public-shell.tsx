import type { ReactNode } from "react";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-text">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-8 md:gap-14 md:py-10">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
