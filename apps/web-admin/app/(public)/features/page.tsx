import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import {
  getFeatureClustersServer,
  getMarketingFeaturesByClusterServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Ozellik merkez sayfasi",
  description:
    "LoomaPOS feature sistemi: cluster hub + detay sayfa yapisi ile SEO ve donusum icin organize edilmis ozellik mimarisi.",
  path: "/features"
});

export default async function FeaturesPage() {
  const clusters = await getFeatureClustersServer();
  const clusterStats = await Promise.all(
    clusters.map(async (cluster) => ({
      cluster,
      features: await getMarketingFeaturesByClusterServer(cluster.slug)
    }))
  );

  return (
    <>
      <PageHero
        eyebrow="Feature hub"
        title="Tum ozellikleri cluster yapisiyla kesfet"
        description="Master hub; cluster bazli gezinmeyi netlestirir, detay sayfalari canonical route modeline baglar ve trial/pricing donusumunu destekler."
        actions={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Cluster taxonomy"
          title="Indexlenebilir cluster merkezleri"
          description="Her cluster kendi hub sayfasina sahiptir ve child feature detaylarini tek yapida sunar."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clusterStats.map(({ cluster, features }) => (
            <Card key={cluster.slug}>
              <CardTitle>{cluster.title_tr}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{cluster.value_proposition_tr}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-text/60">
                {features.length} feature detail
              </p>
              <p className="mt-3 text-sm leading-6 text-text/70">{cluster.audience_tr}</p>
              <Link
                href={`/features/${cluster.slug}` as never}
                className="mt-5 inline-flex text-sm font-semibold text-brand"
              >
                Cluster hub ac
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Quick actions"
          title="Deneme veya fiyatlandirma adimina gec"
          description="Feature IA gezintiden sonra ana funnel korunur: Start Trial -> Pricing -> Checkout -> Onboarding."
        />
        <MarketingCtaGroup
          items={[marketingPrimaryCtas[0], marketingPrimaryCtas[1], marketingSecondaryCtas[0]]}
          context="features_master_hub_bottom"
        />
      </section>
    </>
  );
}
