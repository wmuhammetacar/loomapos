import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import { getAlternativePageBySlugServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

interface AlternativeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AlternativeDetailPageProps) {
  const { slug } = await params;
  const page = await getAlternativePageBySlugServer(slug);

  return buildMetadata({
    title: page?.title ?? "POS alternative",
    description: page?.description ?? "Competitor comparison page.",
    path: `/alternatives/${slug}`
  });
}

export default async function AlternativeDetailPage({
  params
}: AlternativeDetailPageProps) {
  const { slug } = await params;
  const page = await getAlternativePageBySlugServer(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow={page.competitor}
        title={page.title}
        description={page.description}
        actions={marketingPrimaryCtas}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Strengths"
            title="Why LoomaPOS stands out"
            description={page.strengths.join(" ")}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Migration"
            title="Migration advantages"
            description={page.migrationAdvantages.join(" ")}
          />
        </Card>
      </section>

      <Card>
        <h2 className="font-heading text-2xl font-semibold text-text">Comparison table</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-text/65">
                <th className="px-3 py-3 font-semibold">Criteria</th>
                <th className="px-3 py-3 font-semibold">LoomaPOS</th>
                <th className="px-3 py-3 font-semibold">{page.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {page.comparison.map((row) => (
                <tr key={row.label} className="border-b border-line/70 align-top">
                  <td className="px-3 py-4 font-semibold text-text">{row.label}</td>
                  <td className="px-3 py-4 text-text/72">{row.loomapos}</td>
                  <td className="px-3 py-4 text-text/72">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Try LoomaPOS"
          title="Convert comparison traffic into guided evaluation"
          description="Alternative pages should end with an obvious next action, not a dead-end competitor mention."
        />
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context={`alternative_${page.slug}_bottom`} className="mt-6" />
      </section>
    </>
  );
}
