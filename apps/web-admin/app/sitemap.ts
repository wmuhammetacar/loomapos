import type { MetadataRoute } from "next";
import { blogPosts, featureModules, legalDocuments, routeTree, siteConfig } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = routeTree
    .filter((route) => !route.includes("["))
    .map((route) => ({
      url: `${siteConfig.baseUrl}${route}`,
      lastModified: new Date("2026-03-06T00:00:00.000Z")
    }));

  return [
    ...routes,
    ...featureModules.map((feature) => ({
      url: `${siteConfig.baseUrl}/features/${feature.slug}`,
      lastModified: new Date("2026-03-06T00:00:00.000Z")
    })),
    ...blogPosts.map((post) => ({
      url: `${siteConfig.baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt)
    })),
    ...legalDocuments.map((document) => ({
      url: `${siteConfig.baseUrl}/legal/${document.slug}`,
      lastModified: new Date("2026-03-06T00:00:00.000Z")
    }))
  ];
}
