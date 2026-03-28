import featureClusterRulesData from "@/content/feature-cluster-rules.json";
import featurePageRegistryData from "@/content/feature-page-registry.json";

export type FeatureSectionKey =
  | "hero"
  | "problem"
  | "solution"
  | "how_it_works"
  | "benefits"
  | "product_context"
  | "integrations"
  | "visual_proof"
  | "faq"
  | "differentiation"
  | "cta"
  | "related_features"
  | "related_solutions";

export interface DifferentiationBlock {
  unique_claim: string;
  specific_advantage: string;
  supporting_explanation: string;
}

export interface FeatureScreenshot {
  title: string;
  description: string;
  platform: "desktop" | "mobile" | "dashboard";
}

export interface FeatureRegistryEntry {
  route: string;
  cluster: string;
  cluster_slug: string;
  feature_slug: string;
  legacy_slugs?: string[];
  locale?: string;
  primary_keyword: string;
  secondary_keywords: string[];
  primary_intent: "commercial" | "informational";
  meta_title: string;
  h1: string;
  summary?: string;
  forbidden_topics: string[];
  required_links: string[];
  required_sections: FeatureSectionKey[];
  problem: string;
  solution: string;
  how_it_works: string[];
  web_scope: string;
  integration_notes: string[];
  faq: string[];
  benefits: string[];
  visual_proof: string[];
  screenshots: FeatureScreenshot[];
  comparison_links: string[];
  differentiation: DifferentiationBlock;
  section_links: Partial<Record<FeatureSectionKey, string[]>>;
}

export interface FeatureClusterRule {
  primary_intent: string;
  allowed_topics: string[];
  forbidden_topics: string[];
  examples: string[];
  neighbor_conflicts: string[];
  slug: string;
  title_tr: string;
  value_proposition_tr: string;
  audience_tr: string;
  related_solutions: string[];
  folded_into?: string | null;
}

interface FeatureClusterRules {
  version: number;
  clusters: Record<string, FeatureClusterRule>;
}

interface FeatureRegistrySettings {
  title_h1_similarity_threshold: number;
  semantic_overlap_threshold: number;
  differentiation_similarity_threshold: number;
  max_repeated_sentence_ratio: number;
  max_repeated_sentence_ratio_first_block: number;
  max_total_internal_links: number;
  max_links_per_section: Partial<Record<FeatureSectionKey, number>>;
  min_related_features: number;
  max_related_features: number;
}

interface FeaturePageRegistry {
  version: number;
  settings: FeatureRegistrySettings;
  features: FeatureRegistryEntry[];
}

export const featureClusterRules = featureClusterRulesData as FeatureClusterRules;
export const featurePageRegistry = featurePageRegistryData as FeaturePageRegistry;

export const featureClusters = Object.entries(featureClusterRules.clusters)
  .map(([clusterKey, rule]) => ({ clusterKey, ...rule }))
  .filter((cluster) => !cluster.folded_into);

export function getClusterByKey(clusterKey: string) {
  const rule = featureClusterRules.clusters[clusterKey];
  if (!rule || rule.folded_into) {
    return null;
  }

  return {
    clusterKey,
    ...rule
  };
}

export function getClusterBySlug(clusterSlug: string) {
  return featureClusters.find((cluster) => cluster.slug === clusterSlug) ?? null;
}

export function getFeatureRegistryEntryBySlug(slug: string) {
  return featurePageRegistry.features.find((entry) => entry.feature_slug === slug) ?? null;
}

export function getFeatureRegistryEntryByRoute(route: string) {
  return featurePageRegistry.features.find((entry) => entry.route === route) ?? null;
}

export function getFeatureRegistryEntryByLegacySlug(legacySlug: string) {
  return (
    featurePageRegistry.features.find((entry) =>
      (entry.legacy_slugs ?? []).includes(legacySlug)
    ) ?? null
  );
}

export function getFeatureRegistryEntryByAnySlug(slug: string) {
  return getFeatureRegistryEntryBySlug(slug) ?? getFeatureRegistryEntryByLegacySlug(slug);
}

export function getFeatureByClusterAndSlug(clusterSlug: string, featureSlug: string) {
  return (
    featurePageRegistry.features.find(
      (entry) => entry.cluster_slug === clusterSlug && entry.feature_slug === featureSlug
    ) ?? null
  );
}

export function getFeaturesByClusterSlug(clusterSlug: string) {
  return featurePageRegistry.features.filter((entry) => entry.cluster_slug === clusterSlug);
}

export function getCanonicalFeaturePathBySlug(featureSlug: string) {
  const feature = getFeatureRegistryEntryBySlug(featureSlug);
  if (!feature) {
    return `/features/${featureSlug}`;
  }

  return `/features/${feature.cluster_slug}/${feature.feature_slug}`;
}

export function getCanonicalFeaturePathByAnySlug(slug: string) {
  const entry = getFeatureRegistryEntryByAnySlug(slug);
  if (entry) {
    return getCanonicalFeaturePathBySlug(entry.feature_slug);
  }

  return `/features/${slug}`;
}

export function normalizeFeatureLink(href: string) {
  const match = href.match(/^\/features\/([^/]+)$/);
  if (!match) {
    return href;
  }

  return getCanonicalFeaturePathByAnySlug(match[1]);
}

export function isFeatureClusterSlug(slug: string) {
  return Boolean(getClusterBySlug(slug));
}
