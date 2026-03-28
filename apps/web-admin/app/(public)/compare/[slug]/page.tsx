import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { marketingPrimaryCtas } from "@/lib/marketing-content";
import { getMarketingFeatureBySlugServer } from "@/lib/marketing-content-server";
import { getCanonicalFeaturePathBySlug } from "@/lib/feature-governance";
import { buildMetadata } from "@/lib/seo";

interface CompareDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CompareDetailPageProps) {
  const { slug } = await params;
  const feature = await getMarketingFeatureBySlugServer(slug);

  return buildMetadata({
    title: feature ? `${feature.title} karsilastirma` : "Feature compare",
    description:
      feature?.summary ?? "Feature compare detayi: alternatif, plan ve aktivasyon adimlarini ayni karar akisinda gor.",
    path: `/compare/${slug}`
  });
}

export default async function CompareDetailPage({ params }: CompareDetailPageProps) {
  const { slug } = await params;
  const feature = await getMarketingFeatureBySlugServer(slug);

  if (!feature) {
    notFound();
  }

  const featureRoute = feature.route ?? getCanonicalFeaturePathBySlug(feature.slug);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Compare", href: "/compare" },
          { label: feature.title }
        ]}
        className="mb-2"
      />

      <PageHero
        eyebrow="Compare intent"
        title={`${feature.title} icin dogru secimi hizlandir`}
        description="Bu sayfa competitor savasina donusmez. Ama yuksek niyetli kullaniciyi alternatif, pricing ve trial kararina net sekilde tasir."
        actions={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Option 1"
            title="Bu feature nasil bir is ihtiyacini cozer?"
            description={feature.summary}
          />
          <Link href={featureRoute as never} className="mt-4 inline-flex text-sm font-semibold text-brand">
            Feature detayina don
          </Link>
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Option 2"
            title="Hangi planla aktive edilmeli?"
            description="Feature degerlendirmesi pricing ve lisans kapsamiyla birlikte kararlandirilmalidir."
          />
          <Link href="/pricing" className="mt-4 inline-flex text-sm font-semibold text-brand">
            Pricing sayfasina git
          </Link>
        </Card>
      </section>

      <section className="space-y-6 rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Alternatives"
          title="Alternatif ve plan karsilastirma handoff"
          description="Karsilastirma niyeti olan ziyaretciler icin dead-end olmadan bir sonraki dogru rota sunulur."
        />
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/alternatives" className="text-brand">
            Alternatives merkezi
          </Link>
          <Link href="/pricing" className="text-brand">
            Pricing sayfasi
          </Link>
          <Link href={featureRoute as never} className="text-brand">
            Feature detayina geri don
          </Link>
        </div>
      </section>

      <MarketingCtaGroup
        items={[marketingPrimaryCtas[0], marketingPrimaryCtas[1]]}
        context={`compare_${feature.slug}_bottom`}
      />
    </>
  );
}
