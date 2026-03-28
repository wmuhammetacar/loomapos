import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { ScreenshotGallery } from "@/components/site/screenshot-gallery";
import { SectionHeading } from "@/components/site/section-heading";
import { Breadcrumbs } from "@/components/ui/breadcrumb";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingPrimaryCtas } from "@/lib/marketing-content";
import {
  getMarketingFeatureByClusterAndSlugServer,
  getMarketingFeaturesByClusterServer
} from "@/lib/marketing-content-server";
import {
  getFeatureByClusterAndSlug,
  getFeatureRegistryEntryByAnySlug
} from "@/lib/feature-governance";
import { buildMetadata } from "@/lib/seo";

interface FeatureDetailPageProps {
  params: Promise<{ slug: string; feature: string }>;
}

function toLabel(href: string) {
  const clean = href.replace(/^\//, "").split("/").pop() ?? href;
  return clean.replace(/-/g, " ");
}

function parseFaqItem(value: string) {
  const [question, ...answerParts] = value.split("?");
  const hasQuestionMark = value.includes("?");

  return {
    question: hasQuestionMark ? `${question}?` : question,
    answer: answerParts.join("?").trim() || "Detaylar uygulama onboarding adimlarinda paylasilir."
  };
}

export async function generateMetadata({ params }: FeatureDetailPageProps) {
  const { slug, feature } = await params;
  const cluster = slug;
  const registryEntry = getFeatureByClusterAndSlug(cluster, feature);

  if (!registryEntry) {
    const byAnySlug = getFeatureRegistryEntryByAnySlug(feature);

    if (byAnySlug) {
      return buildMetadata({
        title: byAnySlug.meta_title,
        description: byAnySlug.summary ?? byAnySlug.solution,
        path: byAnySlug.route,
        keywords: [byAnySlug.primary_keyword, ...byAnySlug.secondary_keywords]
      });
    }

    return buildMetadata({
      title: "Feature",
      description: "Feature sayfasi bulunamadi.",
      path: `/features/${slug}/${feature}`
    });
  }

  return buildMetadata({
    title: registryEntry.meta_title,
    description: registryEntry.summary ?? registryEntry.solution,
    path: registryEntry.route,
    keywords: [registryEntry.primary_keyword, ...registryEntry.secondary_keywords]
  });
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { slug, feature } = await params;
  const cluster = slug;
  const registryEntry = getFeatureByClusterAndSlug(cluster, feature);

  if (!registryEntry) {
    const byAnySlug = getFeatureRegistryEntryByAnySlug(feature);
    if (byAnySlug) {
      redirect(byAnySlug.route as never);
    }

    notFound();
  }

  if (registryEntry.cluster_slug !== cluster || registryEntry.feature_slug !== feature) {
    redirect(registryEntry.route as never);
  }

  const [featureContent, clusterFeatures] = await Promise.all([
    getMarketingFeatureByClusterAndSlugServer(cluster, feature),
    getMarketingFeaturesByClusterServer(cluster)
  ]);

  if (!featureContent) {
    notFound();
  }

  const dominantCtas = [marketingPrimaryCtas[0], marketingPrimaryCtas[1]];
  const comparisonLinks = registryEntry.comparison_links ?? [];
  const faqItems = registryEntry.faq.map(parseFaqItem);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Features", href: "/features" },
          { label: cluster.replace(/-/g, " "), href: `/features/${cluster}` },
          { label: registryEntry.h1 }
        ]}
        className="mb-2"
      />

      <PageHero
        eyebrow={registryEntry.primary_keyword}
        title={registryEntry.h1}
        description={registryEntry.summary ?? registryEntry.solution}
        actions={dominantCtas}
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Download != License
            </p>
            <p className="text-sm leading-6 text-white/75">
              Download App sadece kurulumdur. Kullanim icin trial veya lisans aktivasyonu gerekir.
            </p>
            <p className="text-sm leading-6 text-white/70">
              Aktivasyon sonrasi operasyon Desktop ve Mobile uygulamada calisir; web sadece yonlendirme katmanidir.
            </p>
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Problem"
            title="Sahadaki temel sorun"
            description={registryEntry.problem}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Solution"
            title="Ozelligin cozdugu nokta"
            description={registryEntry.solution}
          />
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="How it works"
          title="Kullanim akisi"
          description="Deneme veya lisans sonrasi operasyon bu adimlarla uygulama katmaninda ilerler."
        />
        <ol className="grid gap-4 md:grid-cols-2">
          {registryEntry.how_it_works.map((step, index) => (
            <Card key={step} className="text-sm leading-6 text-text/72">
              <strong className="text-text">{index + 1}.</strong> {step}
            </Card>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Benefits"
            title="Isletme etkisi"
            description={registryEntry.benefits.join(" ")}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Product context"
            title="Bu ozellik hangi yuzeyde calisir?"
            description={registryEntry.web_scope}
          />
          <p className="mt-4 text-sm leading-6 text-text/72">
            <strong className="text-text">Desktop:</strong> {featureContent.desktopFlow}
          </p>
          <p className="mt-3 text-sm leading-6 text-text/72">
            <strong className="text-text">Mobile:</strong> {featureContent.mobileFlow}
          </p>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Integrations"
          title="Baglantilar ve bagimli sistemler"
          description="Bu ozellik tek basina degil, ilgili entegrasyon ve modullerle birlikte deger uretir."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {registryEntry.integration_notes.map((note) => (
            <Card key={note} className="text-sm leading-6 text-text/72">
              {note}
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          {(registryEntry.section_links.integrations ?? []).map((href) => (
            <Link key={href} href={href as never} className="text-brand">
              {toLabel(href)}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Visual proof"
          title="Gercek urun akisindan goruntuler"
          description="Bu gorseller web operasyonu degil, Desktop/Mobile urun deneyimini kanitlar."
        />
        <ScreenshotGallery items={featureContent.screenshots} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {registryEntry.visual_proof.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-[32px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Differentiation"
          title="Neden Bu Ozellik Daha Iyi?"
          description={registryEntry.differentiation.unique_claim}
        />
        <Card>
          <CardTitle>Somut avantaj: {registryEntry.differentiation.specific_advantage}</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">
            {registryEntry.differentiation.supporting_explanation}
          </p>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Feature odakli itirazlari kapat"
          description="Fiyat/aktivasyon/operasyon sorularini satin alma oncesi netlestir."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <Card key={`${item.question}-${item.answer}`}>
              <p className="font-semibold text-text">{item.question}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Compare handoff"
          title="Karsilastirma niyetini dogru sayfaya aktar"
          description="Bu sayfa competitor sayfasi degil; karsilastirma niyeti olan kullaniciyi alternatives/compare/pricing akisina tasir."
        />
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          {comparisonLinks.map((href) => (
            <Link key={href} href={href as never} className="text-brand">
              {toLabel(href)}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Action"
          title="Tek ana karar adimini koru"
          description="Bu detail sayfada tek dominant yol: Start Trial (primary) ve View Pricing (secondary)."
        />
        <MarketingCtaGroup
          items={dominantCtas}
          context={`feature_${registryEntry.feature_slug}_bottom`}
          className="mt-6"
        />
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          {(registryEntry.section_links.related_features ?? []).map((href) => (
            <Link key={href} href={href as never} className="text-brand">
              {toLabel(href)}
            </Link>
          ))}
          {(registryEntry.section_links.related_solutions ?? []).map((href) => (
            <Link key={href} href={href as never} className="text-brand">
              {toLabel(href)}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="More in cluster"
          title="Ayni cluster altindaki diger detaylar"
          description="Cluster icinde alternatif ozelliklere gecis, konuyu dagitmadan arastirmayi surdurur."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {clusterFeatures
            .filter((item) => item.slug !== featureContent.slug)
            .slice(0, 3)
            .map((item) => (
              <Card key={item.slug}>
                <CardTitle>{item.title}</CardTitle>
                <p className="mt-3 text-sm leading-6 text-text/72">{item.summary}</p>
                <Link href={(item.route ?? `/features/${cluster}/${item.slug}`) as never} className="mt-4 inline-flex text-sm font-semibold text-brand">
                  Detayi ac
                </Link>
              </Card>
            ))}
        </div>
      </section>
    </>
  );
}
