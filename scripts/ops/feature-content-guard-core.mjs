import fs from "node:fs";
import path from "node:path";

const REQUIRED_SECTIONS = [
  "hero",
  "problem",
  "solution",
  "how_it_works",
  "benefits",
  "product_context",
  "integrations",
  "visual_proof",
  "faq",
  "differentiation",
  "cta"
];

const VALID_ADVANTAGES = new Set([
  "speed",
  "simplicity",
  "control",
  "integration",
  "reliability",
  "cost",
  "visibility"
]);

const GENERIC_DIFFERENTIATION_MARKERS = [
  "en iyi",
  "best",
  "powerful",
  "guclu",
  "yenilikci",
  "kaliteli",
  "kapsamli",
  "cozum"
];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function loadGuardInputs({
  rootDir = process.cwd(),
  registryPath = "apps/web-admin/content/feature-page-registry.json",
  clusterRulesPath = "apps/web-admin/content/feature-cluster-rules.json"
} = {}) {
  const registry = readJson(path.join(rootDir, registryPath));
  const clusterRules = readJson(path.join(rootDir, clusterRulesPath));
  return {
    registry,
    clusterRules,
    paths: {
      registryPath,
      clusterRulesPath
    }
  };
}

export function normalizeText(input) {
  return String(input ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input) {
  return normalizeText(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function frequencyMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1);
  }
  return map;
}

function cosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const freqA = frequencyMap(tokensA);
  const freqB = frequencyMap(tokensB);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of freqA.values()) {
    normA += value * value;
  }
  for (const value of freqB.values()) {
    normB += value * value;
  }

  for (const [token, valueA] of freqA.entries()) {
    const valueB = freqB.get(token);
    if (valueB) {
      dot += valueA * valueB;
    }
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function bigrams(input) {
  const text = normalizeText(input).replace(/\s+/g, " ");
  const result = new Set();
  if (text.length < 2) {
    return result;
  }
  for (let i = 0; i < text.length - 1; i += 1) {
    result.add(text.slice(i, i + 2));
  }
  return result;
}

function diceCoefficient(textA, textB) {
  const a = bigrams(textA);
  const b = bigrams(textB);
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  return (2 * intersection) / (a.size + b.size);
}

function jaccardTokenSimilarity(textA, textB) {
  const a = new Set(tokenize(textA));
  const b = new Set(tokenize(textB));
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function splitSentences(input) {
  return String(input ?? "")
    .split(/[.!?\n]+/g)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);
}

function collectEntryText(entry) {
  return [
    entry.meta_title,
    entry.h1,
    entry.primary_keyword,
    ...(entry.secondary_keywords ?? []),
    entry.problem,
    entry.solution,
    ...(entry.how_it_works ?? []),
    ...(entry.benefits ?? []),
    entry.web_scope,
    ...(entry.integration_notes ?? []),
    ...(entry.visual_proof ?? []),
    ...(entry.faq ?? []),
    entry.differentiation?.unique_claim,
    entry.differentiation?.specific_advantage,
    entry.differentiation?.supporting_explanation
  ]
    .filter(Boolean)
    .join(" \n ");
}

function collectSectionLinks(entry) {
  return Object.entries(entry.section_links ?? {}).flatMap(([, links]) =>
    Array.isArray(links) ? links : []
  );
}

function createReport(totalPages) {
  return {
    totalPages,
    passedPages: 0,
    failedPages: 0,
    failures: [],
    ruleStats: {
      structure: 0,
      keyword_owner: 0,
      title_h1_similarity: 0,
      semantic_overlap: 0,
      cluster_boundary: 0,
      differentiation_block: 0,
      link_budget: 0,
      uniqueness: 0,
      source_drift: 0
    }
  };
}

function pushFailure(report, rule, route, message, details = {}) {
  report.failures.push({ rule, route, message, details });
  report.ruleStats[rule] = (report.ruleStats[rule] ?? 0) + 1;
}

function requiredSectionMissing(entry, section) {
  const checks = {
    hero: Boolean(entry.h1 && entry.meta_title && entry.primary_keyword),
    problem: Boolean(entry.problem),
    solution: Boolean(entry.solution),
    how_it_works: Array.isArray(entry.how_it_works) && entry.how_it_works.length > 0,
    benefits: Array.isArray(entry.benefits) && entry.benefits.length > 0,
    product_context: Boolean(entry.web_scope),
    integrations: Array.isArray(entry.integration_notes) && entry.integration_notes.length > 0,
    visual_proof: Array.isArray(entry.visual_proof) && entry.visual_proof.length > 0,
    faq: Array.isArray(entry.faq) && entry.faq.length > 0,
    differentiation:
      Boolean(entry.differentiation?.unique_claim) &&
      Boolean(entry.differentiation?.specific_advantage) &&
      Boolean(entry.differentiation?.supporting_explanation),
    cta:
      Array.isArray(entry.section_links?.cta) &&
      entry.section_links.cta.length > 0
  };

  return !checks[section];
}

function assertArray(value) {
  return Array.isArray(value) ? value : [];
}

function routeFromEntry(entry) {
  return entry.route || `/features/${entry.feature_slug ?? "unknown"}`;
}

function checkStructure(report, registry, clusterRules) {
  const slugs = new Set();
  const routes = new Set();

  const clusterMap = clusterRules?.clusters ?? {};

  for (const entry of registry.features ?? []) {
    const route = routeFromEntry(entry);
    const clusterRule = clusterMap[entry.cluster];

    if (slugs.has(entry.feature_slug)) {
      pushFailure(report, "structure", route, "Duplicate feature_slug in registry.");
    }
    if (routes.has(route)) {
      pushFailure(report, "structure", route, "Duplicate route in registry.");
    }

    slugs.add(entry.feature_slug);
    routes.add(route);

    if (!clusterRule) {
      pushFailure(report, "structure", route, `Cluster ${entry.cluster} is not defined in cluster rules.`);
    } else {
      if (clusterRule.folded_into) {
        pushFailure(
          report,
          "structure",
          route,
          `Cluster ${entry.cluster} is folded into ${clusterRule.folded_into}. Features must live under the active cluster.`
        );
      }

      if (entry.cluster_slug !== clusterRule.slug) {
        pushFailure(
          report,
          "structure",
          route,
          "cluster_slug must match cluster rule slug.",
          { expected_slug: clusterRule.slug, actual_slug: entry.cluster_slug }
        );
      }
    }

    const expectedRoute = "/features/" + entry.cluster_slug + "/" + entry.feature_slug;
    if (route !== expectedRoute) {
      pushFailure(report, "structure", route, "Route must match /features/<cluster>/<feature_slug>.", { expected: expectedRoute });
    }

    const requiredSections = new Set(assertArray(entry.required_sections));
    for (const section of REQUIRED_SECTIONS) {
      if (!requiredSections.has(section)) {
        pushFailure(report, "structure", route, `Missing required section '${section}' in required_sections.`);
      }
      if (requiredSectionMissing(entry, section)) {
        pushFailure(report, "structure", route, `Missing content for required section '${section}'.`);
      }
    }
  }

  for (const [clusterKey, clusterRule] of Object.entries(clusterMap)) {
    if (clusterRule?.folded_into) {
      continue;
    }

    const hasFeature = (registry.features ?? []).some((entry) => entry.cluster === clusterKey);
    if (!hasFeature) {
      pushFailure(
        report,
        "structure",
        `/features/${clusterRule.slug}`,
        `Active cluster ${clusterKey} has no materialized feature detail page.`
      );
    }
  }
}

function checkKeywordOwner(report, registry) {
  const owners = new Map();

  for (const entry of registry.features ?? []) {
    const key = normalizeText(entry.primary_keyword);
    if (!key) {
      pushFailure(report, "keyword_owner", routeFromEntry(entry), "primary_keyword cannot be empty.");
      continue;
    }

    const existing = owners.get(key);
    if (!existing) {
      owners.set(key, [entry]);
      continue;
    }

    existing.push(entry);
    owners.set(key, existing);
  }

  for (const [keyword, entries] of owners.entries()) {
    if (entries.length < 2) {
      continue;
    }

    for (const entry of entries) {
      pushFailure(
        report,
        "keyword_owner",
        routeFromEntry(entry),
        `primary_keyword '${keyword}' is owned by multiple pages.`,
        { conflicting_routes: entries.map((item) => routeFromEntry(item)) }
      );
    }
  }
}

function checkLocaleAlignment(report, registry) {
  const englishMarkers = ["management", "inventory", "reports", "insights", "staff", "branch", "pricing", "feature"];

  for (const entry of registry.features ?? []) {
    const route = routeFromEntry(entry);
    const locale = String(entry.locale ?? "tr").toLowerCase();

    if (locale !== "tr") {
      continue;
    }

    const h1 = normalizeText(entry.h1);
    const title = normalizeText(entry.meta_title);
    const keyword = normalizeText(entry.primary_keyword);

    if (!h1 || !title || !keyword) {
      pushFailure(report, "structure", route, "TR locale pages must define h1, meta_title and primary_keyword.");
      continue;
    }

    const keywordTokens = keyword.split(" ").filter((token) => token.length > 2);
    const missingToken = keywordTokens.every((token) => !h1.includes(token) && !title.includes(token));
    if (missingToken) {
      pushFailure(
        report,
        "structure",
        route,
        "TR locale page metadata does not align with primary keyword tokens.",
        { primary_keyword: entry.primary_keyword, h1: entry.h1, meta_title: entry.meta_title }
      );
    }

    for (const marker of englishMarkers) {
      if (h1.includes(marker) || title.includes(marker)) {
        pushFailure(
          report,
          "structure",
          route,
          "TR locale page metadata contains English marker and breaks locale consistency.",
          { marker, h1: entry.h1, meta_title: entry.meta_title }
        );
      }
    }
  }
}

function checkTitleH1Similarity(report, registry) {
  const threshold = Number(registry.settings?.title_h1_similarity_threshold ?? 0.6);
  const features = assertArray(registry.features);

  for (let i = 0; i < features.length; i += 1) {
    for (let j = i + 1; j < features.length; j += 1) {
      const a = features[i];
      const b = features[j];
      const sourceA = `${a.meta_title ?? ""} ${a.h1 ?? ""}`;
      const sourceB = `${b.meta_title ?? ""} ${b.h1 ?? ""}`;
      const score =
        cosineSimilarity(sourceA, sourceB) * 0.7 +
        jaccardTokenSimilarity(sourceA, sourceB) * 0.3;

      if (score > threshold) {
        pushFailure(
          report,
          "title_h1_similarity",
          routeFromEntry(a),
          `Title/H1 similarity ${score.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(b), score }
        );
        pushFailure(
          report,
          "title_h1_similarity",
          routeFromEntry(b),
          `Title/H1 similarity ${score.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(a), score }
        );
      }
    }
  }
}

function checkSemanticOverlap(report, registry) {
  const threshold = Number(registry.settings?.semantic_overlap_threshold ?? 0.78);
  const features = assertArray(registry.features);

  for (let i = 0; i < features.length; i += 1) {
    for (let j = i + 1; j < features.length; j += 1) {
      const a = features[i];
      const b = features[j];
      const textA = collectEntryText(a);
      const textB = collectEntryText(b);
      const semanticScore =
        cosineSimilarity(textA, textB) * 0.75 + jaccardTokenSimilarity(textA, textB) * 0.25;

      if (semanticScore > threshold) {
        pushFailure(
          report,
          "semantic_overlap",
          routeFromEntry(a),
          `Semantic overlap ${semanticScore.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(b), score: semanticScore }
        );
        pushFailure(
          report,
          "semantic_overlap",
          routeFromEntry(b),
          `Semantic overlap ${semanticScore.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(a), score: semanticScore }
        );
      }
    }
  }
}

function checkClusterBoundaries(report, registry, clusterRules) {
  const clusterMap = clusterRules?.clusters ?? {};

  for (const entry of registry.features ?? []) {
    const route = routeFromEntry(entry);
    const clusterRule = clusterMap[entry.cluster];

    if (!clusterRule) {
      pushFailure(report, "cluster_boundary", route, `Cluster '${entry.cluster}' is not defined in cluster rules.`);
      continue;
    }

    const allForbidden = [
      ...assertArray(clusterRule.forbidden_topics),
      ...assertArray(entry.forbidden_topics)
    ]
      .map((marker) => normalizeText(marker))
      .filter(Boolean);

    const source = normalizeText(collectEntryText(entry));
    for (const marker of allForbidden) {
      if (!marker || marker.length < 3) {
        continue;
      }
      if (source.includes(marker)) {
        pushFailure(
          report,
          "cluster_boundary",
          route,
          `Forbidden topic marker detected for cluster '${entry.cluster}'.`,
          { marker }
        );
      }
    }
  }
}

function checkDifferentiationBlocks(report, registry) {
  const threshold = Number(registry.settings?.differentiation_similarity_threshold ?? 0.75);
  const features = assertArray(registry.features);

  for (const entry of features) {
    const route = routeFromEntry(entry);
    const block = entry.differentiation ?? {};
    const uniqueClaim = String(block.unique_claim ?? "").trim();
    const specificAdvantage = normalizeText(block.specific_advantage ?? "");
    const supporting = String(block.supporting_explanation ?? "").trim();

    if (uniqueClaim.length < 20) {
      pushFailure(report, "differentiation_block", route, "unique_claim must be at least 20 characters.");
    }

    if (supporting.length < 30) {
      pushFailure(
        report,
        "differentiation_block",
        route,
        "supporting_explanation must be at least 30 characters."
      );
    }

    if (!VALID_ADVANTAGES.has(specificAdvantage)) {
      pushFailure(
        report,
        "differentiation_block",
        route,
        "specific_advantage must be one of the approved advantage types.",
        { specific_advantage: block.specific_advantage }
      );
    }

    const normalizedClaim = normalizeText(uniqueClaim);
    for (const marker of GENERIC_DIFFERENTIATION_MARKERS) {
      if (normalizedClaim.includes(marker) && normalizedClaim.split(" ").length < 10) {
        pushFailure(
          report,
          "differentiation_block",
          route,
          "Differentiation claim is too generic and must be feature-specific.",
          { marker }
        );
      }
    }
  }

  for (let i = 0; i < features.length; i += 1) {
    for (let j = i + 1; j < features.length; j += 1) {
      const a = features[i];
      const b = features[j];
      const textA = `${a.differentiation?.unique_claim ?? ""} ${a.differentiation?.supporting_explanation ?? ""}`;
      const textB = `${b.differentiation?.unique_claim ?? ""} ${b.differentiation?.supporting_explanation ?? ""}`;
      const score = Math.max(cosineSimilarity(textA, textB), diceCoefficient(textA, textB));

      if (score > threshold) {
        pushFailure(
          report,
          "differentiation_block",
          routeFromEntry(a),
          `Differentiation block similarity ${score.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(b), score }
        );
        pushFailure(
          report,
          "differentiation_block",
          routeFromEntry(b),
          `Differentiation block similarity ${score.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`,
          { pair_route: routeFromEntry(a), score }
        );
      }
    }
  }
}

function checkLinkBudget(report, registry) {
  const settings = registry.settings ?? {};
  const maxTotalLinks = Number(settings.max_total_internal_links ?? 14);
  const minRelatedFeatures = Number(settings.min_related_features ?? 2);
  const maxRelatedFeatures = Number(settings.max_related_features ?? 3);
  const maxPerSection = settings.max_links_per_section ?? {};

  for (const entry of registry.features ?? []) {
    const route = routeFromEntry(entry);
    const sectionLinks = entry.section_links ?? {};
    const flatLinks = collectSectionLinks(entry);

    if (flatLinks.length > maxTotalLinks) {
      pushFailure(
        report,
        "link_budget",
        route,
        `Total links ${flatLinks.length} exceed max_total_internal_links ${maxTotalLinks}.`
      );
    }

    for (const [section, links] of Object.entries(sectionLinks)) {
      const sectionMax = Number(maxPerSection[section] ?? 3);
      const count = assertArray(links).length;
      if (count > sectionMax) {
        pushFailure(
          report,
          "link_budget",
          route,
          `Section '${section}' has ${count} links, max allowed is ${sectionMax}.`
        );
      }
    }

    for (const requiredLink of assertArray(entry.required_links)) {
      if (!flatLinks.includes(requiredLink)) {
        pushFailure(
          report,
          "link_budget",
          route,
          `Required link '${requiredLink}' is missing from section_links.`
        );
      }
    }

    const relatedFeatures = assertArray(sectionLinks.related_features);
    if (
      relatedFeatures.length < minRelatedFeatures ||
      relatedFeatures.length > maxRelatedFeatures
    ) {
      pushFailure(
        report,
        "link_budget",
        route,
        `related_features link count must be between ${minRelatedFeatures} and ${maxRelatedFeatures}.`,
        { count: relatedFeatures.length }
      );
    }

    const ctaLinks = assertArray(sectionLinks.cta);
    if (ctaLinks.length === 0 || ctaLinks.length > 2) {
      pushFailure(
        report,
        "link_budget",
        route,
        "cta section must contain 1 or 2 links to keep hierarchy clear.",
        { count: ctaLinks.length }
      );
    }

    if (!ctaLinks.includes("/register") || !ctaLinks.includes("/pricing")) {
      pushFailure(
        report,
        "link_budget",
        route,
        "cta section must include both /register and /pricing for dominant funnel continuity."
      );
    }

    const comparisonLinks = assertArray(entry.comparison_links);
    if (comparisonLinks.length < 3) {
      pushFailure(
        report,
        "link_budget",
        route,
        "comparison_links must include alternatives, compare and pricing handoff links."
      );
    }

    const hasAlternatives = comparisonLinks.includes("/alternatives");
    const hasPricing = comparisonLinks.includes("/pricing");
    const expectedCompareHref = `/compare/${entry.feature_slug}`;
    const hasCompare = comparisonLinks.some((href) => String(href).startsWith("/compare/"));

    if (!hasAlternatives || !hasCompare || !hasPricing) {
      pushFailure(
        report,
        "link_budget",
        route,
        "comparison_links must include /alternatives, /compare/<slug> and /pricing.",
        { comparison_links: comparisonLinks }
      );
    }

    if (!comparisonLinks.includes(expectedCompareHref)) {
      pushFailure(
        report,
        "link_budget",
        route,
        "comparison_links must include the feature-specific compare route.",
        { expected_compare: expectedCompareHref, comparison_links: comparisonLinks }
      );
    }

    for (const href of flatLinks) {
      if (!String(href).startsWith("/")) {
        pushFailure(report, "link_budget", route, "All internal links must start with '/'.", {
          href
        });
      }
    }
  }
}

function checkContentUniqueness(report, registry) {
  const maxRepeatedRatio = Number(registry.settings?.max_repeated_sentence_ratio ?? 0.18);
  const maxFirstBlockRatio = Number(
    registry.settings?.max_repeated_sentence_ratio_first_block ?? 0.1
  );
  const features = assertArray(registry.features);

  const sentenceOwners = new Map();
  for (const entry of features) {
    const route = routeFromEntry(entry);
    const content = collectEntryText(entry);
    for (const sentence of splitSentences(content)) {
      if (sentence.length < 8) {
        continue;
      }
      const owners = sentenceOwners.get(sentence) ?? new Set();
      owners.add(route);
      sentenceOwners.set(sentence, owners);
    }
  }

  for (const entry of features) {
    const route = routeFromEntry(entry);
    const contentSentences = splitSentences(collectEntryText(entry));
    if (contentSentences.length === 0) {
      continue;
    }

    const repeated = contentSentences.filter((sentence) => {
      const owners = sentenceOwners.get(sentence);
      return owners && owners.size > 1;
    });

    const repeatedRatio = repeated.length / contentSentences.length;
    if (repeatedRatio > maxRepeatedRatio) {
      pushFailure(
        report,
        "uniqueness",
        route,
        `Repeated sentence ratio ${repeatedRatio.toFixed(2)} exceeds max ${maxRepeatedRatio.toFixed(2)}.`
      );
    }

    const firstBlockSentences = splitSentences(`${entry.problem} ${entry.solution}`);
    if (firstBlockSentences.length > 0) {
      const repeatedInFirstBlock = firstBlockSentences.filter((sentence) => {
        const owners = sentenceOwners.get(sentence);
        return owners && owners.size > 1;
      });
      const firstBlockRatio = repeatedInFirstBlock.length / firstBlockSentences.length;

      if (firstBlockRatio > maxFirstBlockRatio) {
        pushFailure(
          report,
          "uniqueness",
          route,
          `First block repeated sentence ratio ${firstBlockRatio.toFixed(2)} exceeds max ${maxFirstBlockRatio.toFixed(2)}.`
        );
      }
    }
  }
}

export function validateFeatureContentGuard({ registry, clusterRules }) {
  const report = createReport(assertArray(registry?.features).length);

  checkStructure(report, registry, clusterRules);
  checkKeywordOwner(report, registry);
  checkLocaleAlignment(report, registry);
  checkTitleH1Similarity(report, registry);
  checkSemanticOverlap(report, registry);
  checkClusterBoundaries(report, registry, clusterRules);
  checkDifferentiationBlocks(report, registry);
  checkLinkBudget(report, registry);
  checkContentUniqueness(report, registry);

  const failedRoutes = new Set(report.failures.map((item) => item.route));
  report.failedPages = failedRoutes.size;
  report.passedPages = Math.max(0, report.totalPages - report.failedPages);
  report.reliability =
    report.totalPages === 0
      ? 0
      : Number(((report.passedPages / report.totalPages) * 100).toFixed(2));
  report.valid = report.failures.length === 0;

  return report;
}

export function formatGuardReport(report) {
  const lines = [];
  lines.push(`Feature Content Guard Summary`);
  lines.push(`- total_pages: ${report.totalPages}`);
  lines.push(`- passed_pages: ${report.passedPages}`);
  lines.push(`- failed_pages: ${report.failedPages}`);
  lines.push(`- reliability_percent: ${report.reliability}`);
  lines.push(`- total_failures: ${report.failures.length}`);
  lines.push(`- valid: ${report.valid}`);
  lines.push("- rule_failures:");

  for (const [rule, count] of Object.entries(report.ruleStats)) {
    lines.push(`  - ${rule}: ${count}`);
  }

  if (report.failures.length > 0) {
    lines.push("- violations:");
    for (const failure of report.failures) {
      lines.push(`  - [${failure.rule}] ${failure.route}: ${failure.message}`);
      if (failure.details && Object.keys(failure.details).length > 0) {
        lines.push(`    details: ${JSON.stringify(failure.details)}`);
      }
    }
  }

  return lines.join("\n");
}
