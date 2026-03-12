import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { featureModules, globalCtas } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Features overview",
  description:
    "LoomaPOS modullerinin tamamini ticari bir bakisla inceleyin. Web katmani sadece ozellik anlatimi ve donusum icindir.",
  path: "/features"
});

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Her modul bir satis sayfasi, hicbiri web operasyon ekrani degil"
        description="Sales Operations, Inventory Management, Reporting, Staff Management ve diger tum moduller; Desktop ve Mobile tarafinda nasil calistigini anlatan landing page mimarisiyle sunulur."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Module map"
          title="Feature architecture"
          description="Her sayfada is acisi, cozum, Desktop use case, Mobile use case, screenshot placeholder ve CTA kurgusu korunur."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureModules.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <ul className="mt-4 space-y-2 text-sm text-text/68">
                {feature.proofPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link
                href={`/features/${feature.slug}`}
                className="mt-5 inline-flex text-sm font-semibold text-brand"
              >
                Feature page
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
