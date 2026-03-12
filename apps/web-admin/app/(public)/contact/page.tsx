import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { siteConfig } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Contact",
  description:
    "Sales, support, reseller and onboarding iletisim bilgileri. Web katmani burada da ticari iletisim amaciyla kullanilir.",
  path: "/contact"
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Satis, destek ve bayi iletisimi"
        description="Yeni musteriler, bayi adaylari ve mevcut lisans sahipleri icin iletisim kanallari."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-text">Sales</p>
          <p className="mt-3 text-sm text-text/72">{siteConfig.salesEmail}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-text">Support</p>
          <p className="mt-3 text-sm text-text/72">{siteConfig.supportEmail}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-text">Phone</p>
          <p className="mt-3 text-sm text-text/72">{siteConfig.phone}</p>
        </Card>
      </div>
    </>
  );
}
