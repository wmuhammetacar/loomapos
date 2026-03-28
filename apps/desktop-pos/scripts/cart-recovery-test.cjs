const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { initializeLocalDatabase, closeLocalDatabase, getDatabase } = require("../dist/main/storage/local-db.js");
const { saveCartDraft, getCartDraft, clearCartDraft } = require("../dist/main/storage/local-state-repository.js");
const { seedLocalProducts, createSale } = require("../dist/main/pos/pos-service.js");
const { openCashSession } = require("../dist/main/operations/operations-service.js");
const { restoreCartDraftForSession } = require("../dist/main/pos/cart-draft-service.js");

const tenantId = "00000000-0000-0000-0000-000000000001";
const branchId = "00000000-0000-0000-0000-000000000001";
const deviceId = "device-cart-recovery-test";
const cashierUserId = "cashier-recovery-test";
const knownProductId = "10000000-0000-0000-0000-000000000001";

function createDraftPayload(overrides = {}) {
  return {
    cart: [
      {
        productId: knownProductId,
        name: "Su 0.5L",
        taxRate: 1,
        qty: 2,
        unitPrice: 10,
        discount: 0
      }
    ],
    headerDiscount: 2.5,
    customerName: "Test Musteri",
    paymentDraft: {
      method: "CARD",
      cashReceived: null
    },
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function withDatabase(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loomapos-cart-recovery-"));
  const dbPath = path.join(tempDir, "local.db");

  try {
    initializeLocalDatabase(dbPath);
    seedLocalProducts(tenantId);
    testFn(dbPath);
  } finally {
    closeLocalDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testDraftSavedWhenCartChanges() {
  withDatabase(() => {
    const payloadJson = JSON.stringify(createDraftPayload());
    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson
    });

    const stored = getCartDraft(tenantId, branchId, deviceId);
    assert.ok(stored);
    assert.equal(stored.cashierUserId, cashierUserId);

    const parsed = JSON.parse(stored.payloadJson);
    assert.equal(parsed.cart.length, 1);
    assert.equal(parsed.paymentDraft.method, "CARD");
  });
}

function testDraftRestoredAfterRestart() {
  withDatabase((dbPath) => {
    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson: JSON.stringify(createDraftPayload())
    });

    closeLocalDatabase();
    initializeLocalDatabase(dbPath);

    const recovered = restoreCartDraftForSession(tenantId, branchId, deviceId);
    assert.equal(recovered.restored, true);
    assert.ok(recovered.draft);
    assert.equal(recovered.draft.cart.length, 1);
    assert.equal(recovered.draft.customerName, "Test Musteri");
    assert.equal(recovered.draft.paymentDraft.method, "CARD");
  });
}

function testCheckoutClearsDraft() {
  withDatabase(() => {
    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson: JSON.stringify(createDraftPayload())
    });

    openCashSession({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      cashierName: "Test Cashier",
      openingCashAmount: 100
    });

    createSale(
      {
        tenantId,
        branchId,
        deviceId,
        cashierUserId,
        customerName: "Test Musteri",
        discount: 0,
        paymentMethod: "CASH",
        lines: [
          {
            productId: knownProductId,
            qty: 1,
            unitPrice: 10,
            discount: 0
          }
        ]
      },
      () => "receipt"
    );

    const recovered = restoreCartDraftForSession(tenantId, branchId, deviceId);
    assert.equal(recovered.restored, false);
    assert.equal(recovered.draft, null);
  });
}

function testCancelClearsDraft() {
  withDatabase(() => {
    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson: JSON.stringify(createDraftPayload())
    });

    clearCartDraft(tenantId, branchId, deviceId);
    const stored = getCartDraft(tenantId, branchId, deviceId);
    assert.equal(stored, null);
  });
}

function testMissingProductInDraftDoesNotCrashRestore() {
  withDatabase(() => {
    const payload = createDraftPayload({
      cart: [
        {
          productId: knownProductId,
          name: "Su 0.5L",
          taxRate: 1,
          qty: 1,
          unitPrice: 10,
          discount: 0
        },
        {
          productId: "missing-product-id",
          name: "Kayip Urun",
          taxRate: 10,
          qty: 1,
          unitPrice: 20,
          discount: 0
        }
      ]
    });

    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson: JSON.stringify(payload)
    });

    const recovered = restoreCartDraftForSession(tenantId, branchId, deviceId);
    assert.equal(recovered.restored, true);
    assert.ok(recovered.draft);
    assert.equal(recovered.draft.cart.length, 1);
    assert.equal(recovered.warningCode, "missing_products");
    assert.equal(recovered.skippedProductCount, 1);
  });
}

function testStaleDraftIgnoredSafely() {
  withDatabase(() => {
    saveCartDraft({
      tenantId,
      branchId,
      deviceId,
      cashierUserId,
      payloadJson: JSON.stringify(createDraftPayload())
    });

    const db = getDatabase();
    db.prepare("UPDATE local_cart_drafts SET updated_at = @updatedAt WHERE tenant_id = @tenantId AND branch_id = @branchId AND device_id = @deviceId")
      .run({
        tenantId,
        branchId,
        deviceId,
        updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      });

    const recovered = restoreCartDraftForSession(tenantId, branchId, deviceId);
    assert.equal(recovered.restored, false);
    assert.equal(recovered.warningCode, "stale");
  });
}

try {
  testDraftSavedWhenCartChanges();
  testDraftRestoredAfterRestart();
  testCheckoutClearsDraft();
  testCancelClearsDraft();
  testMissingProductInDraftDoesNotCrashRestore();
  testStaleDraftIgnoredSafely();
  console.log("Desktop cart recovery tests passed.");
} catch (error) {
  console.error("Desktop cart recovery tests failed.");
  throw error;
}
