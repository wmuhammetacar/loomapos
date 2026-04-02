const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "../components/portal/customer-portal-panels-phase6.tsx"),
  "utf8",
);

function testCanonicalStateCoverage() {
  const canonicalStates = [
    "trial_active",
    "trial_expiring",
    "trial_expired",
    "subscription_active",
    "subscription_past_due",
    "subscription_canceled",
    "suspended_blocked",
  ];

  for (const state of canonicalStates) {
    assert.match(source, new RegExp(String.raw`"${state}"`), `missing ${state} in portal lifecycle mapping`);
  }

  assert.match(source, /trial_expiring_soon/);
  assert.match(source, /trial_expired_read_only/);
  assert.match(source, /past_due/);
  assert.match(source, /canceled|cancelled/);
  assert.match(source, /suspended|blocked/);
}

function testBlockedStatesCarryReadOnlyOrBlockedLanguage() {
  const trialExpiredBlock = /if\s*\(backendLifecycle\s*===\s*"trial_expired"[\s\S]*?\);\n\s*}/m.exec(source)?.[0] ?? "";
  const suspendedBlock = /if\s*\(backendLifecycle\s*===\s*"suspended_blocked"[\s\S]*?\);\n\s*}/m.exec(source)?.[0] ?? "";

  assert.match(trialExpiredBlock, /salt-okunur|yazma akisleri kapali|goruntuleme acik/i);
  assert.match(suspendedBlock, /bloklu|yazma akisleri kapali/i);

  assert.doesNotMatch(trialExpiredBlock, /tum izinli operasyon akislari acik/i);
  assert.doesNotMatch(suspendedBlock, /tum izinli operasyon akislari acik/i);
}

function testUpgradeGuidanceConsistency() {
  assert.match(source, /Simdi yukselt|Yukselt ve yazmayi ac|Odeme \/ yenileme adimini ac|Yenilemeyi tekrar ac/);

  const noticeDangerRule = /lifecycle\.state\s*===\s*"suspended_blocked"\s*\|\|\s*lifecycle\.state\s*===\s*"trial_expired"/m;
  const noticeWarningRule = /lifecycle\.state\s*===\s*"trial_expiring"\s*\|\|\s*lifecycle\.state\s*===\s*"subscription_past_due"\s*\|\|\s*lifecycle\.state\s*===\s*"subscription_canceled"/m;

  assert.match(source, noticeDangerRule);
  assert.match(source, noticeWarningRule);
}

try {
  testCanonicalStateCoverage();
  testBlockedStatesCarryReadOnlyOrBlockedLanguage();
  testUpgradeGuidanceConsistency();
  console.log("Web portal lifecycle consistency proof passed.");
} catch (error) {
  console.error("Web portal lifecycle consistency proof failed.");
  throw error;
}
