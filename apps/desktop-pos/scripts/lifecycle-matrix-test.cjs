const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { __desktopLifecycleTestHarness } = require("../dist/main/desktop/desktop-shell-service.js");

const expectedMatrix = {
  trial_active: {
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: false,
    requiresBlock: false,
  },
  trial_expiring: {
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: true,
    requiresBlock: false,
  },
  trial_expired: {
    canCheckout: false,
    canWrite: false,
    canSync: false,
    canView: true,
    requiresUpgradeAction: true,
    requiresBlock: false,
  },
  subscription_active: {
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: false,
    requiresBlock: false,
  },
  subscription_past_due: {
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: true,
    requiresBlock: false,
  },
  subscription_canceled: {
    canCheckout: true,
    canWrite: true,
    canSync: true,
    canView: true,
    requiresUpgradeAction: true,
    requiresBlock: false,
  },
  suspended_blocked: {
    canCheckout: false,
    canWrite: false,
    canSync: false,
    canView: true,
    requiresUpgradeAction: true,
    requiresBlock: true,
  },
};

const aliasPairs = [
  ["trial_expiring_soon", "trial_expiring"],
  ["trial_expired_read_only", "trial_expired"],
  ["past_due", "subscription_past_due"],
  ["past-due", "subscription_past_due"],
  ["canceled", "subscription_canceled"],
  ["cancelled", "subscription_canceled"],
  ["blocked", "suspended_blocked"],
  ["suspended", "suspended_blocked"],
  ["revoked", "suspended_blocked"],
];

function testCanonicalMatrixFlagsMatch() {
  for (const [state, expected] of Object.entries(expectedMatrix)) {
    const policy = __desktopLifecycleTestHarness.resolvePolicy(state);
    assert.equal(policy.state, state);
    assert.equal(policy.canCheckout, expected.canCheckout);
    assert.equal(policy.canWrite, expected.canWrite);
    assert.equal(policy.canSync, expected.canSync);
    assert.equal(policy.canView, expected.canView);
    assert.equal(policy.requiresUpgradeAction, expected.requiresUpgradeAction);
    assert.equal(policy.requiresBlock, expected.requiresBlock);
  }
}

function testAliasNormalization() {
  for (const [raw, expected] of aliasPairs) {
    const normalized = __desktopLifecycleTestHarness.normalizeState(raw);
    assert.equal(normalized, expected);
  }
}

function testCheckoutAndWriteBlockingStates() {
  const blockedStates = ["trial_expired", "suspended_blocked"];
  for (const state of blockedStates) {
    const policy = __desktopLifecycleTestHarness.resolvePolicy(state);
    assert.equal(policy.canCheckout, false);
    assert.equal(policy.canWrite, false);
  }

  const allowedStates = [
    "trial_active",
    "trial_expiring",
    "subscription_active",
    "subscription_past_due",
    "subscription_canceled",
  ];

  for (const state of allowedStates) {
    const policy = __desktopLifecycleTestHarness.resolvePolicy(state);
    assert.equal(policy.canCheckout, true);
    assert.equal(policy.canWrite, true);
  }
}

function testRendererGuidanceContainsBlockedReadOnlyMessaging() {
  const filePath = path.join(__dirname, "../src/renderer/PosWorkspace.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /trial_expired/);
  assert.match(source, /suspended_blocked/);
  assert.match(source, /salt-okunur|salt okunur/i);
  assert.match(source, /Askida\s*\/\s*bloklu|bloklu/i);
  assert.match(source, /const\s+writeLocked\s*=\s*appInfo\.license\.canWrite\s*===\s*false/);
}

try {
  testCanonicalMatrixFlagsMatch();
  testAliasNormalization();
  testCheckoutAndWriteBlockingStates();
  testRendererGuidanceContainsBlockedReadOnlyMessaging();
  console.log("Desktop lifecycle matrix proof tests passed.");
} catch (error) {
  console.error("Desktop lifecycle matrix proof tests failed.");
  throw error;
}
