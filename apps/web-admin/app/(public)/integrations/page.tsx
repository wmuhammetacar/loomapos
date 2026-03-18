import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
import { getIntegrationPagesServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Integrations",
  description:
    "Review LoomaPOS integrations for compliance, payments, hardware and fiscal readiness.",
  path: "/integrations"
});

export default async function IntegrationsPage() {
  const integrationHighlights = await getIntegrationPagesServer();

  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="Integration content that builds buyer confidence"
        description="Visitors can review supported categories, activation expectations and related features without confusing the website with operational integration controls."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Catalog"
          title="Integration categories"
          description="Each integration page reinforces product fit, trust and setup expectations."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {integrationHighlights.map((item) => (
            <Card key={item.slug}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {item.category}
              </p>
              <CardTitle className="mt-2">{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.description}</p>
              <Link href={`/integrations/${item.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Read integration page
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingSecondaryCtas} context="integrations_index_bottom" />
      </section>
    </>
  );
}
