import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import { getAlternativePagesServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "POS alternatives",
  description:
    "Comparison pages for competitor-aware search traffic looking for a LoomaPOS alternative.",
  path: "/alternatives"
});

export default async function AlternativesIndexPage() {
  const alternativePages = await getAlternativePagesServer();

  return (
    <>
      <PageHero
        eyebrow="Alternatives"
        title="Comparison pages for competitor-aware buyers"
        description="These pages capture branded competitor searches and present LoomaPOS as a clearer website-to-activation experience."
        actions={marketingPrimaryCtas}
      />
      <section className="space-y-6">
        <SectionHeading
          eyebrow="Comparisons"
          title="Alternative pages"
          description="Use transparent comparison pages to convert alternative-seeking traffic into demos and trials."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {alternativePages.map((page) => (
            <Card key={page.slug}>
              <CardTitle>{page.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{page.description}</p>
              <Link href={`/alternatives/${page.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                View comparison
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="alternatives_index_bottom" />
      </section>
    </>
  );
}
