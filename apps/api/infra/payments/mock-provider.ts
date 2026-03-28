import crypto from "node:crypto";
import { env } from "../../src-node/config/env";
import {
  type ConfirmPaymentResult,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider
} from "./payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const paymentRef = `mock_${crypto.randomUUID().replaceAll("-", "")}`;

    return {
      provider: "mock",
      paymentRef,
      paymentUrl: `/checkout/mock-pay/${paymentRef}?amount=${input.amount}`,
      status: "pending"
    };
  }

  async confirmPayment(paymentRef: string): Promise<ConfirmPaymentResult> {
    return {
      paymentRef,
      status: "succeeded",
      paidAt: new Date()
    };
  }

  validateWebhook(signature: string | undefined, payload: string): boolean {
    const expected = crypto
      .createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    return Boolean(signature && signature === expected);
  }
}
