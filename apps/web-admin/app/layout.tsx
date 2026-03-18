import type { Metadata } from "next";
import type { ReactNode } from "react";
import { marketingSiteConfig } from "@/lib/marketing-content";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(marketingSiteConfig.baseUrl),
  title: {
    default: `${marketingSiteConfig.name} | POS SaaS Growth Website`,
    template: `%s | ${marketingSiteConfig.name}`
  },
  description: marketingSiteConfig.description
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="tr">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
