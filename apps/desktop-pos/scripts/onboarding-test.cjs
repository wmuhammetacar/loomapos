const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { initializeLocalDatabase, closeLocalDatabase, getDatabase } = require("../dist/main/storage/local-db.js");
const {
  ensureDeviceIdentity,
  saveLocalActivation,
  saveLocalCashierProfile,
  saveLocalSession,
  upsertLocalBranch,
  getAppSetting
} = require("../dist/main/storage/local-state-repository.js");
const {
  getDesktopOnboardingState,
  seedDesktopOnboardingDemo,
  completeDesktopOnboarding
} = require("../dist/main/desktop/desktop-shell-service.js");
const { createSale, getTenantProductStats } = require("../dist/main/pos/pos-service.js");
const { openCashSession } = require("../dist/main/operations/operations-service.js");

const appVersion = "test-onboarding";
const tenantId = "onboarding-tenant-1";
const branchId = "onboarding-branch-1";
const branchName = "Merkez Sube";
const cashierId = "onboarding-cashier-1";

function withDatabase(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loomapos-onboarding-"));
  const dbPath = path.join(tempDir, "local.db");

  try {
    initializeLocalDatabase(dbPath);
    const context = bootstrapRuntimeContext();
    testFn({ dbPath, ...context });
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function bootstrapRuntimeContext() {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const identity = ensureDeviceIdentity("Kasa-Onboarding-Test");

  saveLocalSession({
    tenantId,
    email: "owner@loomapos.local",
    displayName: "Demo Owner",
    companyName: "Demo Magaza",
    portalType: "customer",
    roles: ["owner"],
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt,
    refreshExpiresAt: expiresAt
  });

  saveLocalCashierProfile({
    cashierId,
    tenantId,
    email: "cashier@loomapos.local",
    displayName: "Demo Kasiyer",
    operationalRole: "owner",
    permissions: ["catalog.manage", "sales.write"]
  });

  saveLocalActivation({
    activationId: "activation-onboarding-1",
    tenantId,
    companyName: "Demo Magaza",
    branchId,
    branchName,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    licenseId: "license-onboarding-1",
    licenseKey: "LICENSE-ONBOARDING",
    licenseToken: "TOKEN-ONBOARDING",
    planCode: "trial",
    featureFlags: ["offline"],
    activatedAt: now,
    expiresAt,
    graceDays: 7,
    lastValidationAt: now,
    offlineAllowedUntil: expiresAt,
    status: "trial_active"
  });

  upsertLocalBranch({
    id: branchId,
    tenantId,
    branchCode: "MRKZ",
    branchName,
    isDefault: true
  });

  return {
    deviceId: identity.deviceId
  };
}

function testFirstLaunchOpensOnboarding() {
  withDatabase(() => {
    const onboarding = getDesktopOnboardingState(appVersion);
    assert.equal(onboarding.required, true);
    assert.equal(onboarding.completedAt, null);
    assert.equal(onboarding.firstSaleDone, false);
    assert.equal(onboarding.demoProductCount, 0);
  });
}

function testDemoDataLoadIsIdempotent() {
  withDatabase(() => {
    const first = seedDesktopOnboardingDemo(appVersion);
    assert.ok(first.demoProductCount >= 4);
    assert.ok(first.demoSeededAt);

    const before = getTenantProductStats(tenantId);
    const second = seedDesktopOnboardingDemo(appVersion);
    const after = getTenantProductStats(tenantId);

    assert.equal(second.demoProductCount, first.demoProductCount);
    assert.equal(after.totalProducts, before.totalProducts);
    assert.ok(getAppSetting("desktop_onboarding_demo_seeded_at"));
  });
}

function testCannotCompleteWithoutFirstSale() {
  withDatabase(() => {
    seedDesktopOnboardingDemo(appVersion);
    assert.throws(
      () => completeDesktopOnboarding(appVersion),
      /en az bir test satisi/
    );
  });
}

function testFirstTestSaleUsesRealFlow() {
  withDatabase(({ deviceId }) => {
    seedDesktopOnboardingDemo(appVersion);

    openCashSession({
      tenantId,
      branchId,
      deviceId,
      cashierUserId: cashierId,
      cashierName: "Demo Kasiyer",
      openingCashAmount: 150
    });

    const db = getDatabase();
    const product = db
      .prepare(
        "SELECT id, price FROM local_products WHERE tenant_id = @tenantId ORDER BY created_at ASC LIMIT 1"
      )
      .get({ tenantId });
    assert.ok(product);

    const result = createSale(
      {
        tenantId,
        branchId,
        deviceId,
        cashierUserId: cashierId,
        customerName: "Onboarding Musteri",
        discount: 0,
        paymentMethod: "CASH",
        lines: [
          {
            productId: product.id,
            qty: 1,
            unitPrice: Number(product.price),
            discount: 0
          }
        ]
      },
      () => "receipt"
    );

    assert.ok(result.saleId);
    const onboarding = getDesktopOnboardingState(appVersion);
    assert.equal(onboarding.firstSaleDone, true);
    assert.ok(onboarding.firstSaleAt);
  });
}

function testCompletionPersistsAcrossRestart() {
  withDatabase(({ dbPath, deviceId }) => {
    seedDesktopOnboardingDemo(appVersion);

    openCashSession({
      tenantId,
      branchId,
      deviceId,
      cashierUserId: cashierId,
      cashierName: "Demo Kasiyer",
      openingCashAmount: 200
    });

    const db = getDatabase();
    const product = db
      .prepare(
        "SELECT id, price FROM local_products WHERE tenant_id = @tenantId ORDER BY created_at ASC LIMIT 1"
      )
      .get({ tenantId });

    createSale(
      {
        tenantId,
        branchId,
        deviceId,
        cashierUserId: cashierId,
        customerName: "Onboarding Musteri",
        discount: 0,
        paymentMethod: "CARD",
        lines: [
          {
            productId: product.id,
            qty: 1,
            unitPrice: Number(product.price),
            discount: 0
          }
        ]
      },
      () => "receipt"
    );

    const done = completeDesktopOnboarding(appVersion);
    assert.equal(done.required, false);
    assert.ok(done.completedAt);

    closeLocalDatabase();
    initializeLocalDatabase(dbPath);

    const afterRestart = getDesktopOnboardingState(appVersion);
    assert.equal(afterRestart.required, false);
    assert.ok(afterRestart.completedAt);
    assert.equal(afterRestart.firstSaleDone, true);
  });
}

try {
  testFirstLaunchOpensOnboarding();
  testDemoDataLoadIsIdempotent();
  testCannotCompleteWithoutFirstSale();
  testFirstTestSaleUsesRealFlow();
  testCompletionPersistsAcrossRestart();
  console.log("Desktop onboarding tests passed.");
} catch (error) {
  console.error("Desktop onboarding tests failed.");
  throw error;
}
