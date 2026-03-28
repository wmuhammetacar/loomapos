import {
  loadGuardInputs,
  validateFeatureContentGuard
} from "./feature-content-guard-core.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasRuleFailure(report, rule) {
  return report.failures.some((item) => item.rule === rule);
}

function findFeature(registry, slug) {
  return registry.features.find((feature) => feature.feature_slug === slug);
}

function runCase(name, mutate, expectedRule) {
  const { registry, clusterRules } = loadGuardInputs();
  const registryDraft = clone(registry);
  mutate(registryDraft);
  const report = validateFeatureContentGuard({ registry: registryDraft, clusterRules });
  const passed = hasRuleFailure(report, expectedRule);

  return {
    name,
    expectedRule,
    passed,
    failureCount: report.failures.length,
    sampleFailure: report.failures.find((item) => item.rule === expectedRule) ?? null
  };
}

function main() {
  const results = [
    runCase(
      "duplicate keyword",
      (registry) => {
        registry.features[1].primary_keyword = registry.features[0].primary_keyword;
      },
      "keyword_owner"
    ),
    runCase(
      "similar h1 title",
      (registry) => {
        registry.features[1].meta_title = registry.features[0].meta_title;
        registry.features[1].h1 = registry.features[0].h1;
      },
      "title_h1_similarity"
    ),
    runCase(
      "semantic duplicate",
      (registry) => {
        const source = registry.features[0];
        const target = registry.features[1];
        target.problem = source.problem;
        target.solution = source.solution;
        target.how_it_works = clone(source.how_it_works);
        target.benefits = clone(source.benefits);
        target.web_scope = source.web_scope;
        target.integration_notes = clone(source.integration_notes);
        target.faq = clone(source.faq);
        target.visual_proof = clone(source.visual_proof);
        target.differentiation = clone(source.differentiation);
        target.meta_title = `${source.meta_title} Variant`;
        target.h1 = `${source.h1} Variant`;
      },
      "semantic_overlap"
    ),
    runCase(
      "cluster boundary violation",
      (registry) => {
        const target = findFeature(registry, "online-payments");
        target.solution += " webhook payload mappings ile API handshake zorunludur.";
      },
      "cluster_boundary"
    ),
    runCase(
      "missing differentiation",
      (registry) => {
        const target = findFeature(registry, "reports");
        target.differentiation = {
          unique_claim: "",
          specific_advantage: "",
          supporting_explanation: ""
        };
      },
      "differentiation_block"
    ),
    runCase(
      "over linking",
      (registry) => {
        const target = findFeature(registry, "sales");
        target.section_links.cta = [
          "/register",
          "/pricing",
          "/demo",
          "/download",
          "/integrations"
        ];
      },
      "link_budget"
    )
  ];

  const failed = results.filter((item) => !item.passed);

  for (const result of results) {
    console.log(
      `${result.passed ? "PASS" : "FAIL"} - ${result.name} (expects ${result.expectedRule})`
    );
    if (result.sampleFailure) {
      console.log(`  sample: [${result.sampleFailure.rule}] ${result.sampleFailure.message}`);
    }
  }

  if (failed.length > 0) {
    console.error(`Feature content guard fixtures failed: ${failed.length}`);
    process.exitCode = 1;
  }
}

main();
