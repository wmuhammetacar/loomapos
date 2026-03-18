import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
import { getSolutionPagesServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Industry solutions",
  description:
    "Explore LoomaPOS solution pages for retail, restaurant, cafe, market and boutique businesses.",
  path: "/solutions"
});

export default async function SolutionsIndexPage() {
  const solutionPages = await getSolutionPagesServer();

  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Industry pages that connect pain points to the right product path"
        description="Each solution page packages the right features, screenshots, workflows and CTAs for a specific business type."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Industries"
          title="Choose the business profile that matches your traffic intent"
          description="These pages help the site rank for vertical terms while guiding visitors into trial, demo, pricing and docs."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutionPages.map((page) => (
            <Card key={page.slug}>
              <CardTitle>{page.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{page.description}</p>
              <Link href={`/solutions/${page.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Explore solution
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingSecondaryCtas} context="solutions_index_bottom" />
      </section>
    </>
  );
}
