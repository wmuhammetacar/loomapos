import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { docsCategories, globalCtas } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Documentation center",
  description:
    "Getting started, install desktop, install mobile, activate license, basic setup ve troubleshooting rehberleri.",
  path: "/docs"
});

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Kurulum, aktivasyon ve onboarding bilgi merkezi"
        description="Docs katmani satisa destek olur, aktivasyonu hizlandirir ve support maliyetini azaltir. Operasyonel ekranlar burada da yer almaz."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Knowledge base"
          title="Docs categories"
          description="Getting started, install desktop/mobile, activate license, branch setup, staff setup ve troubleshooting."
        />
        <div className="grid gap-4">
          {docsCategories.map((category) => (
            <Card key={category.slug}>
              <CardTitle>{category.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{category.description}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {category.articles.map((article) => (
                  <div key={article.title} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                    <p className="font-semibold text-text">{article.title}</p>
                    <p className="mt-2 text-sm leading-6 text-text/70">{article.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-brand">{article.duration}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
