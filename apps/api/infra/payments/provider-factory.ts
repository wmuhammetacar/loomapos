import { env } from "../../src-node/config/env";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./payment-provider";

const mockProvider = new MockPaymentProvider();

export function getPaymentProvider(): PaymentProvider {
  switch (env.PAYMENT_PROVIDER) {
    case "mock":
    default:
      return mockProvider;
  }
}
