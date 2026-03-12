import { Suspense } from "react";
import { ResellerLoginForm } from "@/components/forms/reseller-login-form";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller login",
  description:
    "Onayli bayiler icin reseller portal girisi. Customers, commissions ve license-ready customer gorunumleri icin kullanilir.",
  path: "/reseller/login"
});

export default function ResellerLoginPage() {
  return (
    <>
      <PageHero
        eyebrow="Reseller login"
        title="Onayli bayiler icin portal erisimi"
        description="Email ve password ile reseller paneline giris yapin. Bu panel sadece bayi performansi, customer listesi, komisyon ve lisans gorunumu icindir."
      />
      <Suspense fallback={null}>
        <ResellerLoginForm />
      </Suspense>
    </>
  );
}
