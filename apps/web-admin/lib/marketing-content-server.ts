import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { unstable_noStore as noStore } from "next/cache";
import {
  alternativePages as defaultAlternativePages,
  docsCategoriesForIndex as defaultDocsCategoriesForIndex,
  docsPages as defaultDocsPages,
  getDownloadHighlights,
  getPricingHighlights,
  integrationHighlights as defaultIntegrationPages,
  marketingBlogPosts as defaultBlogPosts,
  marketingFeatures as defaultFeaturePages,
  publicIndexableRoutes,
  seoLandingPages as defaultLandingPages,
  solutionPages as defaultSolutionPages,
  supportedMarketingLocales,
  type AlternativePage,
  type DocPage,
  type IntegrationPage,
  type MarketingBlogPost,
  type MarketingFeaturePage,
  type SeoLandingPage,
  type SolutionPage
} from "@/lib/marketing-content";
import {
  featureClusters,
  featurePageRegistry,
  getCanonicalFeaturePathByAnySlug,
  getFeatureByClusterAndSlug,
  getFeatureRegistryEntryByAnySlug,
  type FeatureRegistryEntry
} from "@/lib/feature-governance";

const DATA_DIR = path.join(process.cwd(), ".marketing-data");
const CONTENT_FILE = path.join(DATA_DIR, "marketing-content-snapshot.json");

export interface MarketingContentSnapshot {
  generatedAt: string;
  updatedAt?: string;
  locales: string[];
  landingPages: SeoLandingPage[];
  solutionPages: SolutionPage[];
  featurePages: MarketingFeaturePage[];
  alternativePages: AlternativePage[];
  integrationPages: IntegrationPage[];
  docsPages: DocPage[];
  blogPosts: MarketingBlogPost[];
}

const defaultSnapshot: MarketingContentSnapshot = {
  generatedAt: "2026-03-18T00:00:00.000Z",
  locales: [...supportedMarketingLocales],
  landingPages: [...defaultLandingPages],
  solutionPages: [...defaultSolutionPages],
  featurePages: [...defaultFeaturePages],
  alternativePages: [...defaultAlternativePages],
  integrationPages: [...defaultIntegrationPages],
  docsPages: [...defaultDocsPages],
  blogPosts: [...defaultBlogPosts]
};

function resolveArray<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) && value.length > 0 ? (value as T[]) : fallback;
}

function normalizeSnapshot(input: unknown): MarketingContentSnapshot {
  if (!input || typeof input !== "object") {
    return defaultSnapshot;
  }

  const candidate = input as Partial<MarketingContentSnapshot>;
  return {
    generatedAt:
      typeof candidate.generatedAt === "string"
        ? candidate.generatedAt
        : defaultSnapshot.generatedAt,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
    locales: resolveArray(candidate.locales, defaultSnapshot.locales),
    landingPages: resolveArray(candidate.landingPages, defaultSnapshot.landingPages),
    solutionPages: resolveArray(candidate.solutionPages, defaultSnapshot.solutionPages),
    featurePages: resolveArray(candidate.featurePages, defaultSnapshot.featurePages),
    alternativePages: resolveArray(candidate.alternativePages, defaultSnapshot.alternativePages),
    integrationPages: resolveArray(candidate.integrationPages, defaultSnapshot.integrationPages),
    docsPages: resolveArray(candidate.docsPages, defaultSnapshot.docsPages),
    blogPosts: resolveArray(candidate.blogPosts, defaultSnapshot.blogPosts)
  };
}

function parseSlugFromPath(value: string) {
  const segments = String(value)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments[segments.length - 1] : "";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => Boolean(value && value.trim()))));
}

function findSupplementalFeature(
  entry: FeatureRegistryEntry,
  sourcePages: MarketingFeaturePage[]
) {
  const candidates = uniqueStrings([
    entry.feature_slug,
    ...(entry.legacy_slugs ?? [])
  ]);

  for (const candidate of candidates) {
    const direct = sourcePages.find(
      (feature) =>
        feature.slug === candidate ||
        feature.legacySlugs?.includes(candidate)
    );

    if (direct) {
      return direct;
    }
  }

  return sourcePages.find((feature) => feature.route === entry.route) ?? null;
}

function registryToFeaturePage(
  entry: FeatureRegistryEntry,
  sourcePages: MarketingFeaturePage[]
): MarketingFeaturePage {
  const supplemental = findSupplementalFeature(entry, sourcePages);
  const relatedSolutionsFromRegistry = uniqueStrings(
    (entry.section_links?.related_solutions ?? []).map((href) => parseSlugFromPath(href))
  );

  const relatedSolutions =
    relatedSolutionsFromRegistry.length > 0
      ? relatedSolutionsFromRegistry
      : (supplemental?.relatedSolutions ?? []);

  const legacySlugs = uniqueStrings([
    ...(entry.legacy_slugs ?? []),
    ...(supplemental?.legacySlugs ?? []),
    supplemental?.slug ?? ""
  ]).filter((slug) => slug !== entry.feature_slug);

  const screenshots =
    entry.screenshots?.length > 0
      ? entry.screenshots
      : (supplemental?.screenshots ?? entry.visual_proof.slice(0, 2).map((item) => ({
          title: item,
          description: `${item} goruntusu`,
          platform: "desktop" as const
        })));

  return {
    slug: entry.feature_slug,
    route: entry.route,
    clusterSlug: entry.cluster_slug,
    locale: entry.locale ?? "tr",
    legacySlugs,
    keyword: entry.primary_keyword,
    title: entry.h1,
    summary: entry.summary ?? supplemental?.summary ?? entry.solution,
    whatItDoes: supplemental?.whatItDoes ?? entry.solution,
    desktopFlow:
      supplemental?.desktopFlow ??
      "Operasyonel adimlar Desktop POS uygulamasi icinde yurutulur.",
    mobileFlow:
      supplemental?.mobileFlow ??
      "Saha ve hafif operasyon adimlari Mobile POS uygulamasi icinde yurutulur.",
    businessBenefits:
      entry.benefits?.length > 0
        ? entry.benefits
        : (supplemental?.businessBenefits ?? []),
    usageExamples:
      supplemental?.usageExamples?.length
        ? supplemental.usageExamples
        : entry.how_it_works,
    screenshots,
    relatedSolutions
  };
}

function materializeFeaturePages(sourcePages: MarketingFeaturePage[]) {
  return featurePageRegistry.features.map((entry) =>
    registryToFeaturePage(entry, sourcePages)
  );
}

export async function loadMarketingContentSnapshot() {
  noStore();

  try {
    const raw = await fs.readFile(CONTENT_FILE, "utf8");
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return defaultSnapshot;
  }
}

export async function getSeoLandingPagesServer() {
  return (await loadMarketingContentSnapshot()).landingPages;
}

export async function getSeoLandingPageBySlugServer(slug: string) {
  const pages = await getSeoLandingPagesServer();
  return pages.find((page) => page.slug === slug);
}

export async function getSolutionPagesServer() {
  return (await loadMarketingContentSnapshot()).solutionPages;
}

export async function getSolutionPageBySlugServer(slug: string) {
  const pages = await getSolutionPagesServer();
  return pages.find((page) => page.slug === slug);
}

export async function getMarketingFeaturesServer() {
  const snapshot = await loadMarketingContentSnapshot();
  return materializeFeaturePages(snapshot.featurePages);
}

export async function getMarketingFeaturesByClusterServer(clusterSlug: string) {
  const features = await getMarketingFeaturesServer();
  return features.filter((feature) => feature.clusterSlug === clusterSlug);
}

export async function getFeatureClustersServer() {
  return featureClusters;
}

export async function getFeatureClusterBySlugServer(clusterSlug: string) {
  return featureClusters.find((cluster) => cluster.slug === clusterSlug) ?? null;
}

export async function getMarketingFeatureByClusterAndSlugServer(
  clusterSlug: string,
  featureSlug: string
) {
  const registryEntry = getFeatureByClusterAndSlug(clusterSlug, featureSlug);
  if (!registryEntry) {
    return null;
  }

  const features = await getMarketingFeaturesServer();
  return features.find((feature) => feature.slug === registryEntry.feature_slug) ?? null;
}

export async function getMarketingFeatureBySlugServer(slug: string) {
  const features = await getMarketingFeaturesServer();
  return features.find(
    (feature) =>
      feature.slug === slug ||
      feature.legacySlugs?.includes(slug) ||
      feature.route === slug ||
      feature.route === `/features/${slug}`
  );
}

export async function getCanonicalFeatureSlugServer(slug: string) {
  const feature = await getMarketingFeatureBySlugServer(slug);
  if (feature) {
    return feature.slug;
  }

  const registryEntry = getFeatureRegistryEntryByAnySlug(slug);
  return registryEntry?.feature_slug ?? slug;
}

export async function getAlternativePagesServer() {
  return (await loadMarketingContentSnapshot()).alternativePages;
}

export async function getAlternativePageBySlugServer(slug: string) {
  const pages = await getAlternativePagesServer();
  return pages.find((page) => page.slug === slug);
}

export async function getIntegrationPagesServer() {
  return (await loadMarketingContentSnapshot()).integrationPages;
}

export async function getIntegrationPageBySlugServer(slug: string) {
  const pages = await getIntegrationPagesServer();
  return pages.find((page) => page.slug === slug);
}

export async function getDocsPagesServer() {
  return (await loadMarketingContentSnapshot()).docsPages;
}

export async function getDocPageBySlugServer(slug: string) {
  const pages = await getDocsPagesServer();
  return pages.find((page) => page.slug === slug);
}

export async function getMarketingBlogPostsServer() {
  return (await loadMarketingContentSnapshot()).blogPosts;
}

export async function getMarketingBlogPostBySlugServer(slug: string) {
  const posts = await getMarketingBlogPostsServer();
  return posts.find((post) => post.slug === slug);
}

export async function getMarketingBlogCategoriesServer() {
  const posts = await getMarketingBlogPostsServer();
  return Array.from(new Set(posts.map((post) => post.category)));
}

export async function getMarketingBlogTagsServer() {
  const posts = await getMarketingBlogPostsServer();
  return Array.from(new Set(posts.flatMap((post) => post.tags))).sort();
}

export async function getRelatedFeaturesServer(slugs: string[]) {
  const features = await getMarketingFeaturesServer();

  const resolved = slugs
    .map((slug) => {
      const registryEntry = getFeatureRegistryEntryByAnySlug(slug);
      if (registryEntry) {
        return (
          features.find((feature) => feature.slug === registryEntry.feature_slug) ?? null
        );
      }

      return (
        features.find(
          (feature) => feature.slug === slug || feature.legacySlugs?.includes(slug)
        ) ?? null
      );
    })
    .filter((feature): feature is MarketingFeaturePage => Boolean(feature));

  const seen = new Set<string>();
  return resolved.filter((feature) => {
    if (seen.has(feature.slug)) {
      return false;
    }

    seen.add(feature.slug);
    return true;
  });
}

export async function getRelatedDocsServer(slugs: string[]) {
  const pages = await getDocsPagesServer();
  return slugs
    .map((slug) => pages.find((page) => page.slug === slug))
    .filter((page): page is DocPage => Boolean(page));
}

export async function getRelatedPostsServer(slug: string) {
  const posts = await getMarketingBlogPostsServer();
  return posts.filter((post) => post.slug !== slug).slice(0, 3);
}

export async function getDocsCategoriesForIndexServer() {
  const docsPages = await getDocsPagesServer();
  const groups: Array<{ title: string; description: string; slugs: string[] }> = defaultDocsCategoriesForIndex
    .map((group) => ({
      ...group,
      slugs: group.slugs.filter((slug) => docsPages.some((page) => page.slug === slug))
    }))
    .filter((group) => group.slugs.length > 0);

  const usedSlugs = new Set<string>(groups.flatMap((group) => [...group.slugs]));
  const extraSlugs = docsPages
    .filter((page) => !usedSlugs.has(page.slug))
    .map((page) => page.slug);

  if (extraSlugs.length > 0) {
    groups.push({
      title: "More docs",
      description: "Additional documentation published through the runtime content snapshot.",
      slugs: extraSlugs
    });
  }

  return groups;
}

export async function buildMarketingSitemapRoutesServer() {
  const snapshot = await loadMarketingContentSnapshot();
  const featurePages = materializeFeaturePages(snapshot.featurePages);

  const routes = new Set<string>([
    ...publicIndexableRoutes,
    ...snapshot.landingPages.map((page) => `/${page.slug}`),
    ...snapshot.solutionPages.map((page) => `/solutions/${page.slug}`),
    ...snapshot.alternativePages.map((page) => `/alternatives/${page.slug}`),
    "/compare",
    ...featureClusters.map((cluster) => `/features/${cluster.slug}`),
    ...featurePages.map(
      (feature) => feature.route ?? getCanonicalFeaturePathByAnySlug(feature.slug)
    ),
    ...featurePages.map((feature) => `/compare/${feature.slug}`),
    ...snapshot.integrationPages.map((page) => `/integrations/${page.slug}`),
    ...snapshot.docsPages.map((page) => `/docs/${page.slug}`),
    ...snapshot.blogPosts.map((post) => `/blog/${post.slug}`),
    ...featurePageRegistry.features.flatMap((entry) => entry.comparison_links ?? []),
    "/resellers/apply"
  ]);

  return Array.from(routes).filter((route) => route.startsWith("/"));
}

export async function getMarketingGrowthSnapshotSummary() {
  const snapshot = await loadMarketingContentSnapshot();

  return {
    generatedAt: snapshot.generatedAt,
    updatedAt: snapshot.updatedAt,
    locales: snapshot.locales,
    landingPages: snapshot.landingPages.length,
    solutionPages: snapshot.solutionPages.length,
    featurePages: featurePageRegistry.features.length,
    alternativePages: snapshot.alternativePages.length,
    integrationPages: snapshot.integrationPages.length,
    docsPages: snapshot.docsPages.length,
    blogPosts: snapshot.blogPosts.length,
    pricingHighlights: getPricingHighlights().length,
    downloadHighlights: getDownloadHighlights().length
  };
}
