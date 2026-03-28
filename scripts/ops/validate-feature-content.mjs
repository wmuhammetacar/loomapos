import fs from "node:fs";
import path from "node:path";
import {
  formatGuardReport,
  loadGuardInputs,
  validateFeatureContentGuard
} from "./feature-content-guard-core.mjs";

function parseArgs(argv) {
  const options = {
    rootDir: process.cwd(),
    registryPath: "apps/web-admin/content/feature-page-registry.json",
    clusterRulesPath: "apps/web-admin/content/feature-cluster-rules.json",
    reportPath: "apps/web-admin/.validation/feature-content-guard-report.json"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root" && argv[i + 1]) {
      options.rootDir = argv[i + 1];
      i += 1;
    } else if (arg === "--registry" && argv[i + 1]) {
      options.registryPath = argv[i + 1];
      i += 1;
    } else if (arg === "--clusters" && argv[i + 1]) {
      options.clusterRulesPath = argv[i + 1];
      i += 1;
    } else if (arg === "--report" && argv[i + 1]) {
      options.reportPath = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

function writeReport(rootDir, reportPath, report) {
  const absoluteReportPath = path.join(rootDir, reportPath);
  fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
  fs.writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const markdownPath = absoluteReportPath.replace(/\.json$/i, ".md");
  fs.writeFileSync(markdownPath, `${formatGuardReport(report)}\n`);

  return { absoluteReportPath, markdownPath };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { registry, clusterRules, paths } = loadGuardInputs(options);
  const report = validateFeatureContentGuard({ registry, clusterRules });
  const reportFiles = writeReport(options.rootDir, options.reportPath, report);

  const header = [
    "Feature Content Guard",
    `registry: ${paths.registryPath}`,
    `clusters: ${paths.clusterRulesPath}`,
    `report_json: ${path.relative(options.rootDir, reportFiles.absoluteReportPath)}`,
    `report_md: ${path.relative(options.rootDir, reportFiles.markdownPath)}`
  ].join("\n");

  console.log(header);
  console.log(formatGuardReport(report));

  if (!report.valid) {
    process.exitCode = 1;
  }
}

main();
