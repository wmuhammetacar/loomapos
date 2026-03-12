import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { globalCtas, resellerBenefits, resellerJourney } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller program",
  description:
    "Kimlerin bayi olabilecegini, recurring revenue modelini, egitim ve onboarding avantajlarini inceleyin.",
  path: "/reseller"
});

export default function ResellerLandingPage() {
  return (
    <>
      <PageHero
        eyebrow="Reseller"
        title="Bayi programi ile yeni musteri edinimi ve lisans yenileme geliri"
        description="Saha servis ekipleri, cihaz tedarikcileri ve bolgesel partnerler; recurring revenue, egitim ve onboarding destek paketiyle LoomaPOS bayi programina katilabilir."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Advantages"
          title="Business advantages"
          description="Bayi programi lead getiren bir kanal degil; lisans, aktivasyon ve yenileme gorunurlugu olan bir ticari buyume modeli."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {resellerBenefits.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Onboarding"
          title="Reseller onboarding flow"
          description="Apply, approval, reseller login ve customer/license visibility akisi asagidaki sirayla ilerler."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {resellerJourney.map((item, index) => (
            <Card key={item}>
              <p className="text-sm font-semibold text-brand">0{index + 1}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/reseller/apply" className="text-brand">
            Apply now
          </Link>
          <Link href="/reseller/login" className="text-text">
            Reseller login
          </Link>
        </div>
      </section>
    </>
  );
}
