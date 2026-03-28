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
  getSolutionPageBySlugServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";
import { getCanonicalFeaturePathByAnySlug } from "@/lib/feature-governance";

interface SolutionDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SolutionDetailPageProps) {
  const { slug } = await params;
  const page = await getSolutionPageBySlugServer(slug);

  return buildMetadata({
    title: page?.title ?? "Industry solution",
    description: page?.description ?? "Industry-specific POS solution page.",
    path: `/solutions/${slug}`
  });
}

export default async function SolutionDetailPage({ params }: SolutionDetailPageProps) {
  const { slug } = await params;
  const page = await getSolutionPageBySlugServer(slug);

  if (!page) {
    notFound();
  }

  const relatedFeatures = await getRelatedFeaturesServer(page.featureSlugs);

  return (
    <>
      <PageHero
        eyebrow={page.audience}
        title={page.title}
        description={page.description}
        actions={marketingSecondaryCtas}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Pain points"
            title="Industry pain"
            description={page.painPoints.join(" ")}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Workflows"
            title="How the journey should feel"
            description={page.workflows.join(" ")}
          />
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screenshots"
          title="Screens tailored to this business type"
          description="Visual placeholders help the vertical page feel concrete and premium."
        />
        <ScreenshotGallery items={page.screenshots} />
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Relevant features"
          title="Features most relevant for this industry"
          description="Internal linking from solutions to features helps both SEO depth and buyer education."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {relatedFeatures.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <Link href={getCanonicalFeaturePathByAnySlug(feature.slug) as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Read feature page
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          Testimonial placeholder
        </p>
        <p className="mt-3 text-sm leading-6 text-text/72">{page.testimonialPlaceholder}</p>
      </Card>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="CTA"
          title="From industry evaluation to action"
          description="Solution pages should naturally move the visitor into pricing, demo and download choices."
        />
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`solution_${page.slug}_bottom`} className="mt-6" />
      </section>
    </>
  );
}
