import { MarketingLeadForm } from "@/components/forms/marketing-lead-form";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
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
        title="Sales contact and lead capture"
        description="Capture new sales conversations, route demo interest and keep support contact visible without blurring the boundary between website and portal."
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <MarketingLeadForm
          type="contact"
          title="Talk to sales"
          description="Use this form for pricing questions, migration planning, enterprise requirements or a guided subscription conversation."
          submitLabel="Send Inquiry"
          sourcePath="/contact"
        />
        <div className="space-y-4">
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
      </div>
      <MarketingCtaGroup items={marketingSecondaryCtas} context="contact_bottom" />
    </>
  );
}
