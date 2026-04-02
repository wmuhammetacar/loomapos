const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "lib/api.ts"), "utf8");
const tenantListSource = fs.readFileSync(path.join(root, "app/tenants/page.tsx"), "utf8");
const tenantDetailSource = fs.readFileSync(path.join(root, "app/tenants/[id]/page.tsx"), "utf8");
const subscriptionsSource = fs.readFileSync(path.join(root, "app/subscriptions/page.tsx"), "utf8");

const canonicalStates = [
  "trial_active",
  "trial_expiring",
  "trial_expired",
  "subscription_active",
  "subscription_past_due",
  "subscription_canceled",
  "suspended_blocked",
];

function testApiMappingCoversCanonicalStates() {
  for (const state of canonicalStates) {
    assert.match(
      apiSource,
      new RegExp(String.raw`return\s+"${state}"`),
      `api.ts must map lifecycle state ${state}`,
    );
  }

  assert.match(apiSource, /trial_expiring_soon/);
  assert.match(apiSource, /trial_expired_read_only/);
  assert.match(apiSource, /past_due|past-due/);
  assert.match(apiSource, /canceled|cancelled/);
  assert.match(apiSource, /suspended|blocked/);
}

function testTenantSurfacesCarryConsistentLabels() {
  for (const source of [tenantListSource, tenantDetailSource, subscriptionsSource]) {
    assert.match(source, /Deneme aktif/);
    assert.match(source, /Deneme bitmek uzere/);
    assert.match(source, /Deneme bitti\s*\/\s*salt-okunur/);
    assert.match(source, /Odeme gecikmis/);
    assert.match(source, /Abonelik iptal/);
    assert.match(source, /Askida\s*\/\s*bloklu/i);
  }
}

function testReadOnlyAndBlockedGuidanceNotContradictory() {
  const trialExpiredCase = /case\s+"trial_expired"[\s\S]*?return\s+"([^"]+)";/m.exec(tenantDetailSource);
  assert.ok(trialExpiredCase && /salt-okunur|yazma islemleri kapali|satis ve aktivasyon kapali/i.test(trialExpiredCase[1]));

  const suspendedCase = /case\s+"suspended_blocked"[\s\S]*?return\s+"([^"]+)";/m.exec(tenantDetailSource);
  assert.ok(suspendedCase && /bloklu|devre disi|kapali/i.test(suspendedCase[1]));

  assert.doesNotMatch(trialExpiredCase?.[1] ?? "", /tum operasyon akislari acik/i);
  assert.doesNotMatch(suspendedCase?.[1] ?? "", /tum operasyon akislari acik/i);
}

try {
  testApiMappingCoversCanonicalStates();
  testTenantSurfacesCarryConsistentLabels();
  testReadOnlyAndBlockedGuidanceNotContradictory();
  console.log("Control-center lifecycle consistency proof passed.");
} catch (error) {
  console.error("Control-center lifecycle consistency proof failed.");
  throw error;
}
