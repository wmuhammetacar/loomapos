import express from "express";
import request from "supertest";
import type { Router } from "express";
import { UserRole } from "@prisma/client";
import { describe, beforeEach, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn()
  },
  branch: {
    findFirst: vi.fn(),
    count: vi.fn()
  },
  subscription: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn()
  },
  license: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn()
  },
  device: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  deviceActivationAudit: {
    findMany: vi.fn(),
    create: vi.fn()
  },
  checkoutSession: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  payment: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  invoice: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  refreshToken: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn()
  },
  webhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
}));

const mockProvider = vi.hoisted(() => ({
  createPayment: vi.fn(),
  confirmPayment: vi.fn(),
  validateWebhook: vi.fn()
}));

vi.mock("../infra/prisma/client", () => ({
  prisma: mockPrisma
}));

vi.mock("../infra/payments/provider-factory", () => ({
  getPaymentProvider: () => mockProvider
}));

import { usersRouter } from "../modules/users/routes";
import { tenantRouter } from "../modules/tenant/routes";
import { checkoutRouter } from "../modules/checkout/routes";
import { billingRouter } from "../modules/billing/routes";
import { trialRouter } from "../modules/trial/routes";
import { subscriptionRouter } from "../modules/subscription/routes";
import { authRouter } from "../modules/auth/routes";
import { canAllocateDeviceSlot, requiresNewSlot } from "../modules/license/device-slot-policy";
import { parseEnv } from "../src-node/config/env";
import { errorHandler, notFound } from "../src-node/middleware/error-handler";
import { signAccessToken, signRefreshToken } from "../src-node/utils/jwt";

function makeApp(basePath: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function authHeader(role: UserRole, tenantId = "tenant-a", userId = "user-a") {
  const token = signAccessToken({
    userId,
    tenantId,
    role,
    email: `${userId}@example.test`
  });

  return {
    Authorization: `Bearer ${token}`
  };
}

describe("backend hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
      }

      return arg;
    });

    mockProvider.validateWebhook.mockReturnValue(true);
    mockProvider.confirmPayment.mockResolvedValue({
      paymentRef: "mock_ref",
      status: "succeeded",
      paidAt: new Date()
    });
  });

  it("enforces tenant isolation on user mutation lookup", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const app = makeApp("/users", usersRouter);
    const response = await request(app)
      .patch("/users/user-from-other-tenant")
      .set(authHeader(UserRole.owner, "tenant-a"))
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(404);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-from-other-tenant",
          tenantId: "tenant-a"
        })
      })
    );
  });

  it("blocks reseller role from customer internal tenant routes", async () => {
    const app = makeApp("/tenant", tenantRouter);
    const response = await request(app).get("/tenant/me").set(authHeader(UserRole.reseller, "tenant-a"));

    expect(response.status).toBe(403);
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it("treats already completed checkout as idempotent completion", async () => {
    mockPrisma.$transaction.mockResolvedValueOnce({
      type: "already_paid",
      checkout: {
        id: "chk_1",
        status: "paid",
        payment: {
          id: "pay_1",
          externalRef: "mock_ref"
        }
      }
    });

    const app = makeApp("/checkout", checkoutRouter);
    const response = await request(app)
      .post("/checkout/chk_1/complete")
      .set(authHeader(UserRole.owner, "tenant-a"))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.alreadyCompleted).toBe(true);
    expect(mockProvider.confirmPayment).not.toHaveBeenCalled();
  });

  it("ignores duplicate processed webhook events", async () => {
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      id: "event_1",
      provider: "mock",
      eventId: "evt_1",
      paymentRef: "pay_ref_1",
      payloadHash: "hash",
      status: "processed",
      attempts: 1,
      receivedAt: new Date(),
      processedAt: new Date(),
      failedAt: null,
      lastError: null
    });

    const app = makeApp("/billing", billingRouter);
    const response = await request(app)
      .post("/billing/webhook")
      .set("x-webhook-signature", "ok")
      .send({ paymentRef: "pay_ref_1", status: "succeeded", eventId: "evt_1" });

    expect(response.status).toBe(202);
    expect(response.body.duplicate).toBe(true);
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });

  it("enforces device slot limit policy deterministically", () => {
    expect(requiresNewSlot(null)).toBe(true);
    expect(requiresNewSlot({ status: "active" })).toBe(false);
    expect(canAllocateDeviceSlot(1, 2)).toBe(true);
    expect(canAllocateDeviceSlot(2, 2)).toBe(false);
  });

  it("moves expired trial tenant into read-only mode", async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-a",
      status: "trial",
      subscription: {
        id: "sub_trial_1",
        status: "trial",
        endAt: new Date(Date.now() - 60_000)
      }
    });

    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.tenant.update.mockResolvedValue({});
    mockPrisma.license.updateMany.mockResolvedValue({ count: 1 });

    const app = makeApp("/trial", trialRouter);
    const response = await request(app)
      .post("/trial/expire-check")
      .set(authHeader(UserRole.owner, "tenant-a"))
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.readOnlyMode).toBe(true);
    expect(mockPrisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "read_only",
          activeSlot: null
        })
      })
    );
  });

  it("blocks downgrade when usage exceeds next plan limits", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: "sub_active_1",
      tenantId: "tenant-a",
      planCode: "growth",
      billingCycle: "monthly",
      status: "active"
    });

    mockPrisma.device.count.mockResolvedValue(8);
    mockPrisma.branch.count.mockResolvedValue(3);
    mockPrisma.user.count.mockResolvedValue(20);

    const app = makeApp("/subscription", subscriptionRouter);
    const response = await request(app)
      .patch("/subscription/downgrade")
      .set(authHeader(UserRole.owner, "tenant-a"))
      .send({ planCode: "starter" });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("exceeds target plan limits");
  });

  it("keeps single active license invariant during trial extension", async () => {
    const now = new Date();
    const endAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-a",
      status: "trial",
      subscription: {
        id: "sub_trial_2",
        status: "trial",
        endAt
      }
    });

    mockPrisma.subscription.update.mockResolvedValue({});
    mockPrisma.tenant.update.mockResolvedValue({});
    mockPrisma.license.findFirst.mockResolvedValue({ id: "lic_1" });
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.license.updateMany.mockResolvedValue({ count: 1 });

    const app = makeApp("/trial", trialRouter);
    const response = await request(app)
      .post("/trial/extend")
      .set(authHeader(UserRole.owner, "tenant-a"))
      .send({ days: 3 });

    expect(response.status).toBe(200);
    expect(mockPrisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "active",
          activeSlot: "tenant-a"
        })
      })
    );
    expect(mockPrisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "expired",
          activeSlot: null
        })
      })
    );
  });

  it("blocks refresh token replay after token has already been consumed", async () => {
    const refreshToken = signRefreshToken({
      userId: "user-a",
      tenantId: "tenant-a"
    });

    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: "rt_1",
      userId: "user-a",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user-a",
        tenantId: "tenant-a",
        email: "owner@example.test",
        role: "owner"
      }
    });
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const app = makeApp("/auth", authRouter);
    const response = await request(app).post("/auth/refresh").send({ refreshToken });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("already used");
  });

  it("rejects weak internal admin token in production env validation", () => {
    const base = {
      NODE_ENV: "production",
      PORT: "5001",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      INTERNAL_ADMIN_TOKEN: "replace-with-weak-token",
      JWT_ACCESS_SECRET: "test-access-secret-should-be-long-enough",
      JWT_REFRESH_SECRET: "test-refresh-secret-should-be-long-enough",
      JWT_ACCESS_TTL_MIN: "15",
      JWT_REFRESH_TTL_DAYS: "30",
      PAYMENT_PROVIDER: "mock",
      PAYMENT_WEBHOOK_SECRET: "test-webhook-secret",
      ALLOWED_ORIGINS: "http://127.0.0.1:3000",
      OFFLINE_GRACE_HOURS: "72"
    };

    expect(() => parseEnv(base)).toThrow();
  });
});
