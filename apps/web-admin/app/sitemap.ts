import type { MetadataRoute } from "next";
import { buildMarketingSitemapRoutesServer } from "@/lib/marketing-content-server";
import { marketingSiteConfig } from "@/lib/marketing-content";
import { legalDocuments } from "@/lib/site-content";

const FIXED_LAST_MODIFIED = new Date("2026-03-18T00:00:00.000Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = new Map<string, Date>();

  for (const route of await buildMarketingSitemapRoutesServer()) {
    entries.set(`${marketingSiteConfig.baseUrl}${route}`, FIXED_LAST_MODIFIED);
  }

  for (const document of legalDocuments) {
    entries.set(`${marketingSiteConfig.baseUrl}/legal/${document.slug}`, FIXED_LAST_MODIFIED);
  }

  return Array.from(entries, ([url, lastModified]) => ({
    url,
    lastModified
  }));
}
