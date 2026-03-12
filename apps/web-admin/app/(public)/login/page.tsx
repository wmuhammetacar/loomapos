import { Suspense } from "react";
import { CustomerLoginForm } from "@/components/forms/customer-login-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Customer login",
  description:
    "Subscription, licenses, downloads, billing and device metadata icin musteri portal girisi.",
  path: "/login"
});

export default function LoginPage() {
  return (
    <>
      <PageHero
        eyebrow="Customer login"
        title="Portaliniza giris yapin"
        description="Bu alan sadece commercial portal erisimi icindir. Webde satis veya stok operasyonu yoktur."
      />
      <Suspense fallback={null}>
        <CustomerLoginForm />
      </Suspense>
    </>
  );
}
