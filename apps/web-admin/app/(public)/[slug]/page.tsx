import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { ScreenshotGallery } from "@/components/site/screenshot-gallery";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import {
  getRelatedFeaturesServer,
  getSeoLandingPageBySlugServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

interface SeoLandingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SeoLandingPageProps) {
  const { slug } = await params;
  const page = await getSeoLandingPageBySlugServer(slug);

  return buildMetadata({
    title: page?.title ?? "POS landing page",
    description: page?.description ?? "Keyword focused POS landing page.",
    path: `/${slug}`,
    keywords: page ? [page.keyword, page.industryFocus] : []
  });
}

export default async function SeoLandingPage({ params }: SeoLandingPageProps) {
  const { slug } = await params;
  const page = await getSeoLandingPageBySlugServer(slug);

  if (!page) {
    notFound();
  }

  const relatedFeatures = await getRelatedFeaturesServer(page.featureSlugs);

  return (
    <>
      <PageHero
        eyebrow={page.keyword}
        title={page.title}
        description={page.description}
        actions={marketingPrimaryCtas}
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Search intent
            </p>
            <p className="text-sm leading-6 text-white/75">{page.industryFocus}</p>
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Pain points"
            title="What searchers are trying to solve"
            description={page.painPoints.join(" ")}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Value"
            title="How LoomaPOS responds"
            description={page.valuePoints.join(" ")}
          />
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screenshots"
          title="Desktop and Mobile experience preview"
          description="Preview placeholders help visitors understand what the operational apps feel like without moving the workflow into the browser."
        />
        <ScreenshotGallery items={page.screenshots} />
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Feature fit"
          title="Features mapped to this keyword"
          description="This landing page links directly to the most relevant feature content so traffic can continue deeper into the funnel."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {relatedFeatures.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <Link href={`/features/${feature.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Open feature
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Next step"
          title="Move to trial, pricing, demo or download"
          description="Landing pages should not be dead ends. They should move qualified traffic into the correct conversion path immediately."
        />
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`landing_${page.slug}_bottom`} className="mt-6" />
      </section>
    </>
  );
}
