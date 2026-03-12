import { Suspense } from "react";
import { CheckoutForm } from "@/components/forms/checkout-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Checkout",
  description:
    "Plan secimi, billing period, account creation, billing info, payment method, order summary ve purchase confirmation akisi.",
  path: "/checkout"
});

export default function CheckoutPage() {
  return (
    <>
      <PageHero
        eyebrow="Checkout"
        title="Subscription checkout"
        description="Plan secimi, billing, account olusumu ve payment adapter hazirligi ile Phase 1 satin alma akisinin tamami."
      />
      <Suspense fallback={null}>
        <CheckoutForm />
      </Suspense>
    </>
  );
}
