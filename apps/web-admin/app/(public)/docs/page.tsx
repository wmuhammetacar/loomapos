import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
import {
  getDocsCategoriesForIndexServer,
  getDocsPagesServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Documentation center",
  description:
    "Getting started, install desktop, install mobile, activate license, basic setup ve troubleshooting rehberleri.",
  path: "/docs"
});

export default async function DocsPage() {
  const [docsCategoriesForIndex, docsPages] = await Promise.all([
    getDocsCategoriesForIndexServer(),
    getDocsPagesServer()
  ]);

  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Documentation that accelerates activation and reduces support friction"
        description="The docs portal helps visitors move from evaluation to setup with installation, activation, desktop and mobile guidance. It supports growth without becoming an operational console."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Knowledge base"
          title="Documentation structure"
          description="Getting started, installation, activation and app guides are grouped so buyers and customers can self-serve quickly."
        />
        <div className="grid gap-4">
          {docsCategoriesForIndex.map((category) => (
            <Card key={category.title}>
              <CardTitle>{category.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{category.description}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {category.slugs.map((slug) => {
                  const article = docsPages.find((item) => item.slug === slug);
                  if (!article) {
                    return null;
                  }
                  return (
                    <div key={article.slug} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                      <p className="font-semibold text-text">{article.title}</p>
                      <p className="mt-2 text-sm leading-6 text-text/70">{article.description}</p>
                      <Link href={`/docs/${article.slug}` as never} className="mt-4 inline-flex text-sm font-semibold text-brand">
                        Open article
                      </Link>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docsPages.map((article) => (
            <Card key={article.slug}>
              <CardTitle>{article.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{article.description}</p>
              <Link href={`/docs/${article.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Read documentation
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingSecondaryCtas} context="docs_bottom" />
      </section>
    </>
  );
}
