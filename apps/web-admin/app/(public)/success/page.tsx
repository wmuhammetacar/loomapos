import { Suspense } from "react";
import { SuccessPanel } from "@/components/forms/success-panel";
import { PageHero } from "@/components/site/page-hero";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Purchase success",
  description:
    "Satin alma sonrasi tenant, subscription, license, downloads ve portal next steps gosterimi.",
  path: "/success"
});

export default function SuccessPage() {
  return (
    <>
      <PageHero
        eyebrow="Success"
        title="Odeme tamamlandi, lisansiniz hazir"
        description="Bu ekranda license key, expiry, current plan, download links ve aktivasyon adimlari ozetlenir."
      />
      <Suspense fallback={null}>
        <SuccessPanel />
      </Suspense>
    </>
  );
}
