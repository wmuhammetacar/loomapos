import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Card, CardTitle } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import {
  getFeatureClusterBySlugServer,
  getMarketingFeaturesByClusterServer
} from "@/lib/marketing-content-server";
import { getFeaturesByClusterSlug } from "@/lib/feature-governance";
import { buildMetadata } from "@/lib/seo";

interface FeatureClusterPageProps {
  params: Promise<{ cluster: string }>;
}

export async function generateMetadata({ params }: FeatureClusterPageProps) {
  const { cluster } = await params;
  const clusterInfo = await getFeatureClusterBySlugServer(cluster);

  return buildMetadata({
    title: clusterInfo?.title_tr ?? "Feature cluster",
    description:
      clusterInfo?.value_proposition_tr ??
      "Feature cluster hub sayfasi: ilgili ozellikler, cozum baglantilari ve donusum aksiyonlari.",
    path: `/features/${cluster}`
  });
}

function toLabelFromPath(href: string) {
  const slug = href.split("/").filter(Boolean).at(-1) ?? href;
  return slug.replace(/-/g, " ");
}

export default async function FeatureClusterPage({ params }: FeatureClusterPageProps) {
  const { cluster } = await params;
  const [clusterInfo, features] = await Promise.all([
    getFeatureClusterBySlugServer(cluster),
    getMarketingFeaturesByClusterServer(cluster)
  ]);

  if (!clusterInfo || features.length === 0) {
    notFound();
  }

  const registryEntries = getFeaturesByClusterSlug(cluster);
  const integrationLinks = Array.from(
    new Set(
      registryEntries.flatMap((entry) => entry.section_links.integrations ?? [])
    )
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Features", href: "/features" },
          { label: clusterInfo.title_tr }
        ]}
        className="mb-2"
      />

      <PageHero
        eyebrow="Cluster hub"
        title={clusterInfo.title_tr}
        description={clusterInfo.value_proposition_tr}
        actions={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]}
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Kimin icin?
            </p>
            <p className="text-sm leading-6 text-white/75">{clusterInfo.audience_tr}</p>
            <p className="text-sm leading-6 text-white/70">
              Bu hub altinda yer alan tum detaylar Desktop/Mobile operasyon yuzeyine baglanir; web sadece tanitim ve donusum katmanidir.
            </p>
          </div>
        }
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Feature details"
          title="Bu cluster altindaki ozellikler"
          description="Her kart canonical detail route ile acilir ve trial/pricing funnel'ina doner."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-text/55">
                Keyword: {feature.keyword}
              </p>
              <Link
                href={(feature.route ?? `/features/${cluster}/${feature.slug}`) as never}
                className="mt-5 inline-flex text-sm font-semibold text-brand"
              >
                Feature detayina git
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Related solutions"
            title="Cozum sayfasi baglantilari"
            description="Cluster -> solution baglantisi, kim icin degerli oldugunu netlestirir."
          />
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            {clusterInfo.related_solutions.map((solutionSlug) => (
              <Link
                key={solutionSlug}
                href={`/solutions/${solutionSlug}` as never}
                className="text-brand"
              >
                {solutionSlug.replace(/-/g, " ")}
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Integrations/docs"
            title="Bagli entegrasyon ve dokumanlar"
            description="Feature degerlendirme asamasinda teknik uyum baglantilari hizli ulasilabilir olmalidir."
          />
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            {integrationLinks.map((href) => (
              <Link key={href} href={href as never} className="text-brand">
                {toLabelFromPath(href)}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-6 rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Cluster action"
          title="Trial veya pricing adimina gec"
          description="Cluster hub, donusum omurgasini bolmeden tek ana akisi destekler."
        />
        <MarketingCtaGroup
          items={[marketingPrimaryCtas[0], marketingPrimaryCtas[1], marketingSecondaryCtas[0]]}
          context={`feature_cluster_${cluster}_bottom`}
        />
      </section>
    </>
  );
}
