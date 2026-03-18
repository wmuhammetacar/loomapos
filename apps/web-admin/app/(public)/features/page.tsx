import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingPrimaryCtas } from "@/lib/marketing-content";
import { getMarketingFeaturesServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Features overview",
  description:
    "Explore SEO-ready LoomaPOS feature pages designed to explain the product clearly and convert visitors into demos, trials and subscriptions.",
  path: "/features"
});

export default async function FeaturesPage() {
  const marketingFeatures = await getMarketingFeaturesServer();

  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Feature detail pages built for SEO clarity and high-intent conversion"
        description="Every feature page explains what the capability does, how it works in Desktop and Mobile, and why the business should move into pricing, demo or download next."
        actions={marketingPrimaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Module map"
          title="Feature architecture"
          description="The site now covers sales, inventory, reports, staff, branches, payments, variants, e-invoice, cash register integrations and pricing management."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {marketingFeatures.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <ul className="mt-4 space-y-2 text-sm text-text/68">
                {feature.businessBenefits.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link
                href={`/features/${feature.slug}`}
                className="mt-5 inline-flex text-sm font-semibold text-brand"
              >
                Feature page
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingPrimaryCtas} context="features_index_bottom" />
      </section>
    </>
  );
}
