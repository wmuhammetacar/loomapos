import type { MetadataRoute } from "next";
import { marketingSiteConfig } from "@/lib/marketing-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api",
          "/portal",
          "/reseller/portal",
          "/admin",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/checkout",
          "/success",
          "/auth"
        ]
      }
    ],
    sitemap: `${marketingSiteConfig.baseUrl}/sitemap.xml`
  };
}
