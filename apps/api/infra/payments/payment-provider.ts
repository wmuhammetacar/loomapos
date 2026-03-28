export interface CreatePaymentInput {
  checkoutId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  provider: string;
  paymentRef: string;
  paymentUrl: string;
  status: "pending" | "succeeded";
}

export interface ConfirmPaymentResult {
  paymentRef: string;
  status: "succeeded" | "failed";
  paidAt?: Date;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  confirmPayment(paymentRef: string): Promise<ConfirmPaymentResult>;
  validateWebhook(signature: string | undefined, payload: string): boolean;
}
