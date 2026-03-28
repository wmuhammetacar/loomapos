import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingPrimaryCtas } from "@/lib/marketing-content";
import { getMarketingFeaturesServer } from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Feature compare merkezi",
  description:
    "Feature bazli karsilastirma niyeti tasiyan kullanicilar icin compare merkezi.",
  path: "/compare"
});

export default async function CompareIndexPage() {
  const features = await getMarketingFeaturesServer();

  return (
    <>
      <PageHero
        eyebrow="Compare"
        title="Ozellikleri plan ve alternatif baglaminda karsilastir"
        description="Compare merkezi, feature detay sayfalarindan gelen yuksek niyetli kullaniciyi pricing ve alternatives akisina tasir."
        actions={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Feature compare"
          title="Hangi ozellik hangi ihtiyac icin daha uygun?"
          description="Her compare sayfasi tek bir feature odagini plan ve alternatif baglamina baglar."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.slug}>
              <CardTitle>{feature.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{feature.summary}</p>
              <Link href={`/compare/${feature.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Compare sayfasini ac
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Action"
          title="Karsilastirmadan trial/pricing adimina gec"
          description="Compare sayfalari bilgilendirme degil karar hizlandirma katmanidir."
        />
        <MarketingCtaGroup items={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]} context="compare_index_bottom" />
      </section>
    </>
  );
}
