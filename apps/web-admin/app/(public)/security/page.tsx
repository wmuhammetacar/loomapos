import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas,
  trustSignals
} from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Security",
  description:
    "Review how LoomaPOS separates website, portal and app surfaces and how security and operational boundaries build trust.",
  path: "/security"
});

const securityHighlights = [
  "The website never executes live cashier, stock or branch operations.",
  "Customer and reseller portals are separated from the public marketing site.",
  "License access, downloads and billing visibility stay in the portal layer.",
  "Operational execution remains inside Desktop and Mobile runtimes."
] as const;

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Security and boundary clarity are part of the product trust model"
        description="The website is intentionally constrained: explain the product, convert buyers, distribute apps and route users safely. Operational POS work never happens here."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Principles"
          title="Security starts with strict surface separation"
          description="Visitors, customers and resellers should always know whether they are on the public website, a portal or an operational app."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {securityHighlights.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Trust"
          title="Trust signals used across the growth website"
          description="These trust signals support conversion while reinforcing the product rule that the website is not the POS runtime."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {trustSignals.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="security_bottom" />
    </>
  );
}
