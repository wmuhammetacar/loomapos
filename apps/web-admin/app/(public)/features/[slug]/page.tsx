import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  getCanonicalFeatureSlugServer,
  getMarketingFeatureBySlugServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

interface FeatureDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FeatureDetailPageProps) {
  const { slug } = await params;
  const feature = await getMarketingFeatureBySlugServer(slug);

  if (!feature) {
    return buildMetadata({
      title: "Feature",
      description: "Feature sayfasi bulunamadi.",
      path: `/features/${slug}`
    });
  }

  return buildMetadata({
    title: feature.title,
    description: feature.summary,
    path: `/features/${feature.slug}`
  });
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { slug } = await params;
  const feature = await getMarketingFeatureBySlugServer(slug);

  if (!feature) {
    notFound();
  }

  const canonicalSlug = await getCanonicalFeatureSlugServer(slug);
  if (canonicalSlug !== slug) {
    redirect(`/features/${canonicalSlug}`);
  }

  return (
    <>
      <PageHero
        eyebrow={feature.keyword}
        title={feature.title}
        description={feature.summary}
        actions={marketingPrimaryCtas}
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Feature detail page
            </p>
            <p className="text-sm leading-6 text-white/75">{feature.whatItDoes}</p>
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="What it does"
            title="Capability summary"
            description={feature.whatItDoes}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Business impact"
            title="Why buyers care"
            description={feature.businessBenefits.join(" ")}
          />
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Desktop use case</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">{feature.desktopFlow}</p>
        </Card>
        <Card>
          <CardTitle>Mobile use case</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">{feature.mobileFlow}</p>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screenshots"
          title="Desktop and Mobile walkthrough placeholders"
          description="These product visuals support trust and SEO while keeping live workflows inside the real apps."
        />
        <ScreenshotGallery items={feature.screenshots} />
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Use cases"
          title="Example usage"
          description="Business-ready scenarios help visitors understand fit before they commit to demo, trial or purchase."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {feature.usageExamples.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Action"
          title="Move from feature education to action"
          description="Each feature page drives the visitor into the right next step: pricing, trial, demo, download or reseller evaluation."
        />
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`feature_${feature.slug}_bottom`} className="mt-6" />
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          {feature.relatedSolutions.map((solution) => (
            <Link key={solution} href={`/solutions/${solution}` as never} className="text-brand">
              {solution}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
