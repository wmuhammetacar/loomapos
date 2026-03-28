import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { getPaymentProvider } from "../../infra/payments/provider-factory";
import {
  getPlanLimits,
  getPlanPrice,
  getSubscriptionEndDate,
  type BillingCycle,
  type PlanCode
} from "../../src-node/config/plans";
import { env } from "../../src-node/config/env";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { ApiError, asyncHandler, readRouteParam } from "../../src-node/utils/http";
import { generateLicenseKey } from "../auth/service";
import { resolveCheckoutCompletionDecision } from "./idempotency";

const checkoutSchema = z.object({
  planCode: z.enum(["starter", "growth", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"])
});

const CHECKOUT_PROCESSING_STALE_MS = 90_000;

export const checkoutRouter = Router();

checkoutRouter.use(requireAuth);
checkoutRouter.use(requireRoles([UserRole.owner, UserRole.admin]));

checkoutRouter.post(
  "/session",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const body = checkoutSchema.parse(req.body);

    if (body.planCode === "enterprise") {
      throw new ApiError(422, "Enterprise plan requires sales contact");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.auth!.userId
      }
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const amount = getPlanPrice(body.planCode, body.billingCycle);
    if (amount <= 0) {
      throw new ApiError(422, "Invalid plan pricing");
    }

    const provider = getPaymentProvider();

    const checkout = await prisma.checkoutSession.create({
      data: {
        tenantId,
        email: user.email,
        planCode: body.planCode,
        billingCycle: body.billingCycle,
        amount,
        currency: "TRY",
        status: "pending"
      }
    });

    const paymentInit = await provider.createPayment({
      checkoutId: checkout.id,
      amount,
      currency: "TRY",
      customerEmail: user.email,
      metadata: {
        tenantId,
        planCode: body.planCode,
        billingCycle: body.billingCycle
      }
    });

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        provider: paymentInit.provider,
        externalRef: paymentInit.paymentRef,
        amount,
        currency: "TRY",
        status: paymentInit.status
      }
    });

    const updatedCheckout = await prisma.checkoutSession.update({
      where: {
        id: checkout.id
      },
      data: {
        paymentId: payment.id,
        providerSessionId: paymentInit.paymentRef,
        status: paymentInit.status === "succeeded" ? "paid" : "pending"
      }
    });

    return res.status(201).json({
      checkout: updatedCheckout,
      payment: {
        id: payment.id,
        ref: payment.externalRef,
        status: payment.status,
        paymentUrl: paymentInit.paymentUrl
      }
    });
  })
);

checkoutRouter.post(
  "/:checkoutId/complete",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const checkoutId = readRouteParam(req.params.checkoutId, "checkoutId");

    const claim = await prisma.$transaction(
      async (tx) => claimCheckoutCompletion(tx, { checkoutId, tenantId }),
      {
        isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
      }
    );

    if (claim.type === "not_found") {
      throw new ApiError(404, "Checkout session not found");
    }

    if (claim.type === "already_paid") {
      return res.json({
        checkout: claim.checkout,
        alreadyCompleted: true
      });
    }

    if (claim.type === "in_progress") {
      return res.status(202).json({
        checkout: claim.checkout,
        inProgress: true,
        message: "Checkout completion is already in progress"
      });
    }

    if (claim.type !== "claimed") {
      throw new ApiError(409, "Checkout cannot be completed in current state");
    }

    if (!claim.checkout.payment) {
      throw new ApiError(409, "Checkout payment reference is missing");
    }

    const provider = getPaymentProvider();
    const confirmation = await provider.confirmPayment(claim.checkout.payment.externalRef);

    if (confirmation.status !== "succeeded") {
      const failureResult = await prisma.$transaction(
        async (tx) => {
          const current = await tx.checkoutSession.findFirst({
            where: {
              id: checkoutId,
              tenantId
            },
            include: {
              payment: true
            }
          });

          if (!current || !current.payment) {
            throw new ApiError(404, "Checkout session not found");
          }

          if (current.status === "paid") {
            return {
              type: "already_paid" as const,
              checkout: current
            };
          }

          if (current.status === "processing") {
            if (current.payment.status !== "succeeded") {
              await tx.payment.update({
                where: {
                  id: current.payment.id
                },
                data: {
                  status: "failed"
                }
              });
            }

            await tx.checkoutSession.update({
              where: {
                id: current.id
              },
              data: {
                status: "failed",
                processingStartedAt: null
              }
            });
          }

          return {
            type: "failed" as const
          };
        },
        {
          isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
        }
      );

      if (failureResult.type === "already_paid") {
        return res.json({
          checkout: failureResult.checkout,
          alreadyCompleted: true
        });
      }

      throw new ApiError(402, "Payment could not be confirmed");
    }

    const now = confirmation.paidAt ?? new Date();
    const result = await prisma.$transaction(
      async (tx) => {
        const checkout = await tx.checkoutSession.findFirst({
          where: {
            id: checkoutId,
            tenantId
          },
          include: {
            payment: true
          }
        });

        if (!checkout || !checkout.payment) {
          throw new ApiError(404, "Checkout session not found");
        }

        if (checkout.status === "paid") {
          const existingInvoice = checkout.payment.invoiceId
            ? await tx.invoice.findUnique({
                where: {
                  id: checkout.payment.invoiceId
                }
              })
            : null;
          const subscription = await tx.subscription.findUnique({
            where: {
              tenantId
            }
          });

          return {
            subscription,
            invoice: existingInvoice,
            payment: checkout.payment,
            checkout
          };
        }

        if (checkout.status !== "processing") {
          throw new ApiError(409, "Checkout is not in completable state");
        }

        const endAt = getSubscriptionEndDate(now, checkout.billingCycle as BillingCycle);

        const subscription = await tx.subscription.upsert({
          where: {
            tenantId
          },
          create: {
            tenantId,
            planCode: checkout.planCode,
            billingCycle: checkout.billingCycle,
            status: "active",
            startAt: now,
            endAt
          },
          update: {
            planCode: checkout.planCode,
            billingCycle: checkout.billingCycle,
            status: "active",
            startAt: now,
            endAt,
            cancelAt: null,
            downgradePlanCode: null
          }
        });

        await tx.tenant.update({
          where: {
            id: tenantId
          },
          data: {
            planCode: checkout.planCode,
            status: "active",
            trialEndsAt: null
          }
        });

        await upsertLicenseForPlan(tx, {
          tenantId,
          subscriptionId: subscription.id,
          planCode: checkout.planCode as PlanCode,
          expiresAt: endAt
        });

        let invoice = checkout.payment.invoiceId
          ? await tx.invoice.findUnique({
              where: {
                id: checkout.payment.invoiceId
              }
            })
          : null;

        if (!invoice) {
          invoice = await tx.invoice.create({
            data: {
              tenantId,
              subscriptionId: subscription.id,
              number: generateInvoiceNumber(tenantId),
              status: "paid",
              totalAmount: checkout.amount,
              currency: checkout.currency,
              issuedAt: now,
              dueAt: now,
              paidAt: now,
              lines: {
                create: [
                  {
                    description: `${checkout.planCode.toUpperCase()} plan - ${checkout.billingCycle}`,
                    quantity: 1,
                    unitPrice: checkout.amount,
                    total: checkout.amount
                  }
                ]
              }
            }
          });
        }

        const payment = await tx.payment.update({
          where: {
            id: checkout.payment.id
          },
          data: {
            status: "succeeded",
            confirmedAt: now,
            invoiceId: invoice.id
          }
        });

        const finalCheckout = await tx.checkoutSession.update({
          where: {
            id: checkout.id
          },
          data: {
            status: "paid",
            completedAt: now,
            processingStartedAt: null
          }
        });

        return { subscription, invoice, payment, checkout: finalCheckout };
      },
      {
        isolationLevel: PrismaRuntime.TransactionIsolationLevel.Serializable
      }
    );

    return res.json(result);
  })
);

checkoutRouter.get(
  "/:checkoutId",
  asyncHandler(async (req, res) => {
    const tenantId = req.auth!.tenantId;
    const checkoutId = readRouteParam(req.params.checkoutId, "checkoutId");

    const checkout = await prisma.checkoutSession.findFirst({
      where: {
        id: checkoutId,
        tenantId
      },
      include: {
        payment: true
      }
    });

    if (!checkout) {
      throw new ApiError(404, "Checkout session not found");
    }

    return res.json({ checkout });
  })
);

function generateInvoiceNumber(tenantId: string) {
  const stamp = Date.now().toString();
  return `INV-${tenantId.slice(0, 6).toUpperCase()}-${stamp.slice(-8)}`;
}

async function upsertLicenseForPlan(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    subscriptionId: string;
    planCode: PlanCode;
    expiresAt: Date;
  }
) {
  const limits = getPlanLimits(args.planCode);

  const activeLicense = await tx.license.findFirst({
    where: {
      tenantId: args.tenantId,
      status: "active"
    },
    orderBy: {
      issuedAt: "desc"
    }
  });

  const commonData = {
    subscriptionId: args.subscriptionId,
    activeSlot: args.tenantId,
    expiresAt: args.expiresAt,
    maxDevices: limits.maxDevices,
    maxBranches: limits.maxBranches,
    maxStaff: limits.maxStaff,
    featureFlags: limits.features,
    offlineGraceHours: env.OFFLINE_GRACE_HOURS,
    revalidationRequiredAt: new Date(Date.now() + env.OFFLINE_GRACE_HOURS * 60 * 60 * 1000)
  };

  if (activeLicense) {
    await tx.license.updateMany({
      where: {
        tenantId: args.tenantId,
        status: "active",
        id: {
          not: activeLicense.id
        }
      },
      data: {
        status: "expired",
        activeSlot: null
      }
    });

    await tx.license.update({
      where: {
        id: activeLicense.id
      },
      data: commonData
    });

    return;
  }

  await tx.license.create({
    data: {
      tenantId: args.tenantId,
      key: generateLicenseKey(),
      status: "active",
      issuedAt: new Date(),
      ...commonData
    }
  });
}

type CheckoutWithPayment = Prisma.CheckoutSessionGetPayload<{
  include: {
    payment: true;
  };
}>;

type ClaimResult =
  | { type: "not_found" }
  | { type: "already_paid"; checkout: CheckoutWithPayment }
  | { type: "in_progress"; checkout: CheckoutWithPayment }
  | { type: "not_completable" }
  | { type: "claimed"; checkout: CheckoutWithPayment };

async function claimCheckoutCompletion(
  tx: Prisma.TransactionClient,
  args: { checkoutId: string; tenantId: string }
): Promise<ClaimResult> {
  const checkout = await tx.checkoutSession.findFirst({
    where: {
      id: args.checkoutId,
      tenantId: args.tenantId
    },
    include: {
      payment: true
    }
  });

  if (!checkout || !checkout.payment) {
    return { type: "not_found" };
  }

  const now = new Date();
  const decision = resolveCheckoutCompletionDecision({
    status: checkout.status,
    processingStartedAt: checkout.processingStartedAt,
    now,
    staleAfterMs: CHECKOUT_PROCESSING_STALE_MS
  });

  if (decision === "already_paid") {
    return { type: "already_paid", checkout };
  }

  if (decision === "in_progress") {
    return { type: "in_progress", checkout };
  }

  if (decision === "not_completable") {
    return { type: "not_completable" };
  }

  if (decision === "claim") {
    const claimed = await tx.checkoutSession.updateMany({
      where: {
        id: checkout.id,
        status: {
          in: ["pending", "failed"]
        }
      },
      data: {
        status: "processing",
        processingStartedAt: now
      }
    });

    if (claimed.count !== 1) {
      return { type: "in_progress", checkout };
    }
  }

  if (decision === "reclaim_stale") {
    const staleBefore = new Date(now.getTime() - CHECKOUT_PROCESSING_STALE_MS);

    const reclaimed = await tx.checkoutSession.updateMany({
      where: {
        id: checkout.id,
        status: "processing",
        OR: [{ processingStartedAt: null }, { processingStartedAt: { lte: staleBefore } }]
      },
      data: {
        status: "processing",
        processingStartedAt: now
      }
    });

    if (reclaimed.count !== 1) {
      return { type: "in_progress", checkout };
    }
  }

  const claimedCheckout = await tx.checkoutSession.findFirst({
    where: {
      id: checkout.id,
      tenantId: args.tenantId
    },
    include: {
      payment: true
    }
  });

  if (!claimedCheckout || !claimedCheckout.payment) {
    return { type: "not_found" };
  }

  return {
    type: "claimed",
    checkout: claimedCheckout
  };
}
