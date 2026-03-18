import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import {
  getIntegrationPageBySlugServer,
  getRelatedFeaturesServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

interface IntegrationDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: IntegrationDetailPageProps) {
  const { slug } = await params;
  const page = await getIntegrationPageBySlugServer(slug);

  return buildMetadata({
    title: page?.title ?? "Integration page",
    description: page?.description ?? "Integration marketing detail page.",
    path: `/integrations/${slug}`
  });
}

export default async function IntegrationDetailPage({
  params
}: IntegrationDetailPageProps) {
  const { slug } = await params;
  const page = await getIntegrationPageBySlugServer(slug);

  if (!page) {
    notFound();
  }

  const relatedFeatures = await getRelatedFeaturesServer(page.relatedFeatureSlugs);

  return (
    <>
      <PageHero
        eyebrow={page.category}
        title={page.title}
        description={page.description}
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="What this integration content explains"
          description="Integration pages help searchers understand fit, rollout expectations and related platform capabilities."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {page.capabilities.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Related features"
          title="Feature pages connected to this integration"
          description="Internal linking between integration and feature pages strengthens SEO and user clarity."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {relatedFeatures.map((feature) => (
            <Card key={feature.slug}>
              <p className="font-semibold text-text">{feature.title}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <Link href={`/features/${feature.slug}` as never} className="mt-4 inline-flex text-sm font-semibold text-brand">
                Open feature
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`integration_${page.slug}_bottom`} />
    </>
  );
}
