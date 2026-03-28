import crypto from "node:crypto";
import { Router } from "express";
import { Prisma as PrismaRuntime, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { getPaymentProvider } from "../../infra/payments/provider-factory";
import { env } from "../../src-node/config/env";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";
import { ApiError, asyncHandler, readRouteParam } from "../../src-node/utils/http";
import { canProcessWebhookEvent, nextPaymentStatus } from "./webhook-policy";

const webhookSchema = z.object({
  eventId: z.string().min(3).optional(),
  paymentRef: z.string().min(6),
  status: z.enum(["succeeded", "failed"]).default("succeeded")
});

export const billingRouter = Router();

billingRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const provider = getPaymentProvider();
    const signature = req.headers["x-webhook-signature"];
    const payloadText = JSON.stringify(req.body ?? {});

    if (!provider.validateWebhook(typeof signature === "string" ? signature : undefined, payloadText)) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    const body = webhookSchema.parse(req.body);
    const providerEventIdHeader =
      typeof req.headers["x-provider-event-id"] === "string"
        ? req.headers["x-provider-event-id"]
        : typeof req.headers["x-webhook-id"] === "string"
          ? req.headers["x-webhook-id"]
          : undefined;

    const payloadHash = crypto.createHash("sha256").update(payloadText).digest("hex");
    const providerName = env.PAYMENT_PROVIDER;
    const eventId = body.eventId ?? providerEventIdHeader ?? `${body.paymentRef}:${payloadHash}`;

    const result = await prisma.$transaction(
      async (tx) => {
        const existingEvent = await tx.webhookEvent.findUnique({
          where: {
            provider_eventId: {
              provider: providerName,
              eventId
            }
          }
        });

        if (existingEvent && !canProcessWebhookEvent(existingEvent.status)) {
          return {
            accepted: true,
            duplicate: true,
            state: existingEvent.status
          };
        }

        const event = existingEvent
          ? await tx.webhookEvent.update({
              where: {
                id: existingEvent.id
              },
              data: {
                status: "processing",
                attempts: {
                  increment: 1
                },
                paymentRef: body.paymentRef,
                payloadHash,
                failedAt: null,
                lastError: null
              }
            })
          : await tx.webhookEvent.create({
              data: {
                provider: providerName,
                eventId,
                paymentRef: body.paymentRef,
                payloadHash,
                status: "processing",
                attempts: 1
              }
            });

        const payment = await tx.payment.findFirst({
          where: {
            externalRef: body.paymentRef
          }
        });

        if (!payment) {
          await tx.webhookEvent.update({
            where: {
              id: event.id
            },
            data: {
              status: "failed",
              failedAt: new Date(),
              lastError: "payment_not_found"
            }
          });

          return {
            accepted: true,
            duplicate: false,
            state: "failed",
            ignoredReason: "payment_not_found"
          };
        }

        const targetStatus = nextPaymentStatus(payment.status, body.status);
        const confirmedAt = targetStatus === "succeeded" ? payment.confirmedAt ?? new Date() : payment.confirmedAt;

        await tx.payment.update({
          where: {
            id: payment.id
          },
          data: {
            status: targetStatus,
            confirmedAt
          }
        });

        await tx.webhookEvent.update({
          where: {
            id: event.id
          },
          data: {
            status: "processed",
            processedAt: new Date(),
            failedAt: null,
            lastError: null
          }
        });

        return {
          accepted: true,
          duplicate: false,
          state: "processed"
        };
      },
      {
        isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
      }
    );

    return res.status(202).json(result);
  })
);

billingRouter.use(requireAuth);
billingRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

billingRouter.get(
  "/invoices",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId
      },
      include: {
        lines: true,
        payment: {
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            currency: true,
            confirmedAt: true
          }
        }
      },
      orderBy: {
        issuedAt: "desc"
      }
    });

    return res.json({ invoices });
  })
);

billingRouter.get(
  "/invoices/:invoiceId",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const invoiceId = readRouteParam(req.params.invoiceId, "invoiceId");

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId
      },
      include: {
        lines: true,
        payment: true,
        subscription: true
      }
    });

    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }

    return res.json({ invoice });
  })
);

billingRouter.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;

    const payments = await prisma.payment.findMany({
      where: {
        tenantId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json({ payments });
  })
);

billingRouter.post(
  "/payments/:paymentId/confirm",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const paymentId = readRouteParam(req.params.paymentId, "paymentId");

    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId
      }
    });

    if (!payment) {
      throw new ApiError(404, "Payment not found");
    }

    if (payment.status === "succeeded") {
      return res.json({ payment });
    }

    const provider = getPaymentProvider();
    const result = await provider.confirmPayment(payment.externalRef);
    const targetStatus = nextPaymentStatus(payment.status, result.status);

    const updated = await prisma.payment.update({
      where: {
        id: payment.id
      },
      data: {
        status: targetStatus,
        confirmedAt: targetStatus === "succeeded" ? result.paidAt ?? new Date() : payment.confirmedAt
      }
    });

    return res.json({ payment: updated });
  })
);
