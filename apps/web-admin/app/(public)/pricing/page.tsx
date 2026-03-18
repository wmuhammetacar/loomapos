import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { PricingShowcase } from "@/components/site/pricing-showcase";
import { SchemaScript } from "@/components/site/schema-script";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import {
  getPricingHighlights,
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import { pricingFaq } from "@/lib/site-content";
import { buildFaqSchema, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Starter, Pro ve Enterprise planlarini aylik veya yillik olarak karsilastirin. Satin alma tamamlandiginda lisans ve portal erisimi olusur.",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <>
      <SchemaScript schema={buildFaqSchema(pricingFaq)} />
      <PageHero
        eyebrow="Pricing"
        title="Pricing that turns evaluation into subscription"
        description="Choose a plan, compare monthly and yearly pricing, understand your license scope and move directly into purchase, trial or app download."
        actions={marketingPrimaryCtas}
      />

      <PricingShowcase />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Trust badges"
            title="What happens after purchase"
            description="A customer account is created, the subscription is activated, the license becomes visible and the download path is ready for Desktop and Mobile."
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="License explanation"
            title="License rules stay readable"
            description="Every plan explains device, branch and user scope clearly. Enforcement happens during activation in the apps, not on the website."
          />
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Plan summary"
          title="A clean commercial comparison layer"
          description="Pricing cards help buyers self-qualify before they move into checkout, demo or reseller conversation."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {getPricingHighlights().map((plan) => (
            <Card key={plan.code}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {plan.code}
              </p>
              <p className="mt-3 text-lg font-semibold text-text">{plan.name}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{plan.summary}</p>
              <p className="mt-5 text-sm text-text/72">
                Monthly {plan.monthlyPrice} TRY · Yearly {plan.yearlyPrice} TRY
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="FAQ"
          title="Pricing questions"
          description="Addressing commercial objections directly improves conversion confidence."
        />
        <div className="grid gap-4">
          {pricingFaq.map((item) => (
            <Card key={item.question}>
              <p className="font-semibold text-text">{item.question}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.answer}</p>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="pricing_bottom" />
      </section>
    </>
  );
}
