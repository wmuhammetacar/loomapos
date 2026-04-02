const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const {
  closeLocalDatabase,
  getDatabase,
  initializeLocalDatabase
} = require("../dist/main/storage/local-db.js");
const {
  activateDesktopDevice,
  completeDesktopOnboarding,
  getDesktopActivationContext,
  getDesktopBootstrapState,
  getDesktopOnboardingState,
  getDesktopRuntimeContext,
  loginDesktopUser
} = require("../dist/main/desktop/desktop-shell-service.js");
const { openCashSession } = require("../dist/main/operations/operations-service.js");
const { createSale } = require("../dist/main/pos/pos-service.js");

const appVersion = "test-activation-flow";
const tenantId = "tenant-activation-test";
const demoEmail = "demo.owner@loomapos.local";
const demoPassword = "Demo12345";
const accessToken = "desktop-access-token";

function createTempDbPath(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    tempDir,
    dbPath: path.join(tempDir, "local.db")
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function createMockCommerceServer() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const stats = {
    loginRequests: 0,
    activationRequests: 0,
    heartbeatRequests: 0
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    const json = (statusCode, payload) => {
      res.statusCode = statusCode;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    };

    const text = (statusCode, payload) => {
      res.statusCode = statusCode;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(payload);
    };

    const requiresBearer = () => {
      const auth = req.headers.authorization || "";
      if (auth !== `Bearer ${accessToken}`) {
        text(401, "unauthorized");
        return false;
      }
      return true;
    };

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        return json(200, { status: "ok" });
      }

      if (req.method === "POST" && url.pathname === "/commerce/auth/desktop-login") {
        stats.loginRequests += 1;
        const body = await readJsonBody(req);
        if ((body?.password || "") !== demoPassword) {
          return text(401, "invalid credentials");
        }

        return json(200, {
          accessToken,
          refreshToken: "desktop-refresh-token",
          expiresAt,
          refreshExpiresAt,
          portalType: "customer",
          roles: ["tenant_owner"],
          email: demoEmail,
          displayName: "Demo Owner",
          tenantId,
          companyName: "Demo Magaza"
        });
      }

      if (req.method === "GET" && url.pathname === "/commerce/portal/company/me") {
        if (!requiresBearer()) {
          return;
        }
        return json(200, {
          id: tenantId,
          companyName: "Demo Magaza",
          tenantCode: "DMO",
          billingEmail: demoEmail,
          country: "TR",
          locale: "tr-TR",
          status: "active"
        });
      }

      if (req.method === "GET" && url.pathname === "/commerce/portal/licenses/active") {
        if (!requiresBearer()) {
          return;
        }
        return json(200, {
          id: "license-desktop-activation",
          tenantId,
          subscriptionId: "subscription-desktop-activation",
          planCode: "trial",
          licenseKey: "LIC-DESKTOP-TRIAL",
          licenseToken: "TOKEN-DESKTOP-TRIAL",
          signature: "sig",
          featuresJson: JSON.stringify(["offline", "inventory"]),
          deviceLimit: 3,
          issuedAt: now.toISOString(),
          expiresAt,
          graceDays: 7,
          status: "trial_active",
          createdAt: now.toISOString()
        });
      }

      if (req.method === "GET" && url.pathname === "/commerce/portal/catalog/products") {
        if (!requiresBearer()) {
          return;
        }
        return json(200, [
          {
            id: "product-demo-1",
            name: "Demo Su 0.5L",
            sku: "SU-05",
            barcode: "869000000001",
            unit: "adet",
            taxRate: 1,
            price: 20,
            isActive: true,
            updatedAt: now.toISOString()
          },
          {
            id: "product-demo-2",
            name: "Demo Kola",
            sku: "KOLA-1",
            barcode: "869000000002",
            unit: "adet",
            taxRate: 10,
            price: 35,
            isActive: true,
            updatedAt: now.toISOString()
          }
        ]);
      }

      if (req.method === "POST" && url.pathname === "/commerce/license/activate") {
        stats.activationRequests += 1;
        const body = await readJsonBody(req);
        if (!body?.deviceId || !body?.licenseToken) {
          return text(422, "invalid activation payload");
        }

        return json(200, {
          id: "activation-desktop-1",
          tenantId,
          licenseId: "license-desktop-activation",
          deviceId: body.deviceId,
          deviceName: body.deviceName,
          platform: "desktop",
          appVersion,
          activationSource: "desktop",
          status: "active",
          activatedAt: now.toISOString(),
          lastSeenAt: now.toISOString(),
          revokedAt: null,
          updatedAt: now.toISOString()
        });
      }

      if (req.method === "POST" && url.pathname === "/commerce/license/heartbeat") {
        stats.heartbeatRequests += 1;
        const body = await readJsonBody(req);
        if (!body?.deviceId) {
          return text(422, "deviceId required");
        }

        return json(200, {
          deviceId: body.deviceId,
          lastSeenAt: new Date().toISOString(),
          status: "active",
          licenseStatus: "active",
          expiresAt,
          lifecycleState: "trial_active",
          canCheckout: true,
          canWrite: true,
          canSync: true,
          canView: true,
          requiresUpgradeAction: false,
          requiresBlock: false,
          allowedActions: ["sale", "write", "sync"],
          blockedActions: []
        });
      }

      text(404, `no route for ${req.method} ${url.pathname}`);
    } catch (error) {
      text(500, error instanceof Error ? error.message : "server error");
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("cannot resolve mock server address");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    stats
  };
}

async function runProof() {
  const { tempDir, dbPath } = createTempDbPath("loomapos-activation-flow-");
  const mock = await createMockCommerceServer();
  process.env.LOOMAPOS_API_BASE = mock.baseUrl;

  try {
    initializeLocalDatabase(dbPath);

    const coldStart = await getDesktopBootstrapState(appVersion);
    assert.equal(coldStart.stage, "login_required");
    assert.equal(coldStart.session, null);

    await assert.rejects(
      () => loginDesktopUser(appVersion, { email: demoEmail, password: "wrong" }),
      /API 401/
    );

    const afterLogin = await loginDesktopUser(appVersion, {
      email: demoEmail,
      password: demoPassword
    });
    assert.equal(afterLogin.stage, "activation_required");
    assert.ok(afterLogin.session);
    assert.equal(afterLogin.session.email, demoEmail);

    const context = await getDesktopActivationContext(appVersion);
    assert.equal(context.tenantId, tenantId);
    assert.equal(context.planCode, "trial");

    const afterActivation = await activateDesktopDevice(appVersion, {
      branchName: "Merkez Sube",
      branchCode: "MRKZ",
      deviceName: "Kasa-Activation-Test"
    });
    assert.equal(afterActivation.stage, "ready");
    assert.ok(afterActivation.activation);
    assert.equal(afterActivation.activation.tenantId, tenantId);

    const onboardingBeforeSale = getDesktopOnboardingState(appVersion);
    assert.equal(onboardingBeforeSale.required, true);

    const runtime = getDesktopRuntimeContext(appVersion);
    openCashSession({
      tenantId: runtime.tenantId,
      branchId: runtime.branchId,
      deviceId: runtime.deviceId,
      cashierUserId: runtime.cashierUserId,
      cashierName: runtime.cashierName,
      openingCashAmount: 100
    });

    const db = getDatabase();
    const product = db
      .prepare("SELECT id, price FROM local_products WHERE tenant_id = @tenantId ORDER BY created_at ASC LIMIT 1")
      .get({ tenantId: runtime.tenantId });
    assert.ok(product);

    const sale = createSale(
      {
        tenantId: runtime.tenantId,
        branchId: runtime.branchId,
        deviceId: runtime.deviceId,
        cashierUserId: runtime.cashierUserId,
        customerName: "Ilk Musteri",
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
    assert.ok(sale.saleId);

    const onboardingAfterSale = getDesktopOnboardingState(appVersion);
    assert.equal(onboardingAfterSale.firstSaleDone, true);

    const onboardingCompleted = completeDesktopOnboarding(appVersion);
    assert.equal(onboardingCompleted.required, false);
    assert.ok(onboardingCompleted.completedAt);

    closeLocalDatabase();
    initializeLocalDatabase(dbPath);

    const afterRestart = await getDesktopBootstrapState(appVersion);
    assert.equal(afterRestart.stage, "ready");
    assert.ok(afterRestart.session);
    assert.ok(afterRestart.activation);

    const onboardingAfterRestart = getDesktopOnboardingState(appVersion);
    assert.equal(onboardingAfterRestart.required, false);

    assert.ok(mock.stats.loginRequests >= 2);
    assert.ok(mock.stats.activationRequests >= 1);
    assert.ok(mock.stats.heartbeatRequests >= 1);

    console.log("Desktop activation flow tests passed.");
  } finally {
    closeLocalDatabase();
    await new Promise((resolve) => mock.server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.LOOMAPOS_API_BASE;
  }
}

runProof().catch((error) => {
  console.error("Desktop activation flow tests failed.");
  throw error;
});
