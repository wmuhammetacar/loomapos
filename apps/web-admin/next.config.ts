import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

interface FeatureRegistryEntry {
  route: string;
  feature_slug: string;
  legacy_slugs?: string[];
}

interface FeatureRegistry {
  features: FeatureRegistryEntry[];
}

interface FeatureClusterRule {
  slug: string;
  folded_into?: string | null;
}

interface FeatureClusterRules {
  clusters: Record<string, FeatureClusterRule>;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildFeatureRedirects() {
  const root = process.cwd();
  const registryPath = path.join(root, "content", "feature-page-registry.json");
  const clustersPath = path.join(root, "content", "feature-cluster-rules.json");

  const registry = readJson<FeatureRegistry>(registryPath);
  const clusterRules = readJson<FeatureClusterRules>(clustersPath);

  const clusterSlugs = new Set(
    Object.values(clusterRules.clusters)
      .filter((cluster) => !cluster.folded_into)
      .map((cluster) => cluster.slug)
  );

  const redirects = new Map<string, { source: string; destination: string; permanent: boolean }>();

  for (const entry of registry.features) {
    const candidates = [entry.feature_slug, ...(entry.legacy_slugs ?? [])];

    for (const candidate of candidates) {
      if (!candidate || clusterSlugs.has(candidate)) {
        continue;
      }

      const source = `/features/${candidate}`;
      if (source === entry.route) {
        continue;
      }

      redirects.set(source, {
        source,
        destination: entry.route,
        permanent: true
      });
    }
  }

  return Array.from(redirects.values());
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return buildFeatureRedirects();
  }
};

export default nextConfig;
