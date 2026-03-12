import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { featureModules, getFeatureBySlug, heroActions } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

interface FeatureDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return featureModules.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: FeatureDetailPageProps) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);

  if (!feature) {
    return buildMetadata({
      title: "Feature",
      description: "Feature sayfasi bulunamadi.",
      path: `/features/${slug}`
    });
  }

  return buildMetadata({
    title: feature.title,
    description: feature.summary,
    path: `/features/${slug}`
  });
}

export default async function FeatureDetailPage({ params }: FeatureDetailPageProps) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);

  if (!feature) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow={feature.shortTitle}
        title={feature.title}
        description={feature.summary}
        actions={heroActions}
        aside={
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Sales page only
            </p>
            <p className="text-sm leading-6 text-white/75">{feature.solution}</p>
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Pain point"
            title="Is acisi"
            description={feature.painPoint}
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="Solution"
            title="Cozum yaklasimi"
            description={feature.solution}
          />
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Desktop use case</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">{feature.desktopUseCase}</p>
        </Card>
        <Card>
          <CardTitle>Mobile use case</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">{feature.mobileUseCase}</p>
        </Card>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screen placeholders"
          title="Screenshots or UI placeholders"
          description="Tarayicida canli operasyon degil, istemci yuzeylerini temsil eden placeholder bloklar."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {feature.screenshotLabels.map((label, index) => (
            <Card key={label}>
              <div className="flex h-56 items-center justify-center rounded-[24px] border border-dashed border-line bg-muted/20 text-sm text-text/55">
                Preview {index + 1}
              </div>
              <p className="mt-4 text-sm font-semibold text-text">{label}</p>
            </Card>
          ))}
        </div>
      </section>

      {feature.integrations?.length ? (
        <section className="space-y-6">
          <SectionHeading
            eyebrow="Integrations"
            title="Integration notes"
            description="Bu entegrasyonlarin operasyonel kullanimi uygulama tarafinda calisir."
          />
          <div className="flex flex-wrap gap-3">
            {feature.integrations.map((item) => (
              <span
                key={item}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text/72"
              >
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[36px] border border-line bg-white px-6 py-8">
        <SectionHeading
          eyebrow="Action"
          title="Bu modulu webde satin, uygulamada kullanin"
          description="Pricing, download ve reseller CTA yapisi her feature sayfasinda ayni ticari mantikla tekrar eder."
        />
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/pricing" className="text-brand">
            Pricing
          </Link>
          <Link href="/download" className="text-text">
            Download
          </Link>
          <Link href="/reseller" className="text-text">
            Reseller
          </Link>
        </div>
      </section>
    </>
  );
}
