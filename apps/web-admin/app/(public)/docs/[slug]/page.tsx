import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SchemaScript } from "@/components/site/schema-script";
import { ScreenshotGallery } from "@/components/site/screenshot-gallery";
import { Card } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import {
  getDocPageBySlugServer,
  getRelatedFeaturesServer
} from "@/lib/marketing-content-server";
import { buildArticleSchema, buildMetadata } from "@/lib/seo";
import { getCanonicalFeaturePathByAnySlug } from "@/lib/feature-governance";

interface DocDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DocDetailPageProps) {
  const { slug } = await params;
  const page = await getDocPageBySlugServer(slug);

  return buildMetadata({
    title: page?.title ?? "Documentation article",
    description: page?.description ?? "Documentation detail page.",
    path: `/docs/${slug}`
  });
}

export default async function DocDetailPage({ params }: DocDetailPageProps) {
  const { slug } = await params;
  const page = await getDocPageBySlugServer(slug);

  if (!page) {
    notFound();
  }

  const relatedFeatures = await getRelatedFeaturesServer(page.relatedFeatureSlugs);

  return (
    <>
      <SchemaScript
        schema={buildArticleSchema({
          title: page.title,
          description: page.description,
          path: `/docs/${page.slug}`,
          section: page.category
        })}
      />
      <PageHero
        eyebrow={page.category}
        title={page.title}
        description={page.description}
        actions={marketingSecondaryCtas}
      />

      <div className="space-y-6">
        {page.sections.map((section) => (
          <Card key={section.heading}>
            <h2 className="font-heading text-2xl font-semibold text-text">{section.heading}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-text/72">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <section className="space-y-6">
        <ScreenshotGallery
          items={[
            {
              title: `${page.title} desktop view`,
              description: "Documentation screenshot placeholder for the desktop app.",
              platform: "desktop"
            },
            {
              title: `${page.title} mobile view`,
              description: "Documentation screenshot placeholder for the mobile app.",
              platform: "mobile"
            }
          ]}
        />
      </section>

      <Card>
        <h2 className="font-heading text-2xl font-semibold text-text">Troubleshooting</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-text/72">
          {page.troubleshooting.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-heading text-2xl font-semibold text-text">Related features</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-brand">
          {relatedFeatures.map((item) => (
            <Link key={item.slug} href={getCanonicalFeaturePathByAnySlug(item.slug) as never}>
              {item.title}
            </Link>
          ))}
        </div>
      </Card>

      <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`docs_${page.slug}_bottom`} />
    </>
  );
}
