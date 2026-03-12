import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { PricingShowcase } from "@/components/site/pricing-showcase";
import { SchemaScript } from "@/components/site/schema-script";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  ecosystemCards,
  featurePreviewGrid,
  heroActions,
  licensingFlow,
  pricingPlans,
  resellerBenefits,
  sectorBlocks,
  supportChannels,
  trustStats
} from "@/lib/site-content";
import { buildMetadata, buildSoftwareSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "POS SaaS subscription hub",
  description:
    "LoomaPOS; tanitim, fiyatlandirma, lisans dagitimi, bayi kazanimi ve uygulama indirme merkezi olarak konumlanan ticari web platformudur.",
  path: "/"
});

export default function HomePage() {
  return (
    <>
      <SchemaScript schema={buildSoftwareSchema()} />

      <PageHero
        eyebrow="Phase 1 Web Platform"
        title="Perakende POS ekosisteminizi webden satin alin, Desktop ve Mobile'da kullanin."
        description="Bu website sadece urun tanitimi, fiyatlandirma, aylik-yillik abonelik satisi, bayi programi, lisans teslimi, account portal, uygulama indirme ve onboarding icin tasarlanmistir. Gercek operasyonel POS akislari yalnizca Desktop ve Mobile uygulamalarda calisir."
        actions={heroActions}
        aside={
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Absolute product rule
            </p>
            <p className="text-lg font-semibold">
              Web katmani asla kasa, stok, personel veya sube operasyonu calistirmaz.
            </p>
            <ul className="space-y-2 text-sm leading-6 text-white/75">
              <li>Buy subscription</li>
              <li>Get license key</li>
              <li>Download apps</li>
              <li>Activate on Desktop/Mobile</li>
            </ul>
          </div>
        }
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Trust"
          title="Binlerce isletmenin beklentisine gore konumlanmis ticari yapi"
          description="Market, kirtasiye, sarkuteri, giyim ve akaryakit gibi hizli isleyen sektorlerde urunun nasil konumlandirilmasi gerektigini bilen bir B2B SaaS yaklasimi."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {trustStats.map((item) => (
            <Card key={item.label}>
              <p className="font-heading text-4xl font-bold text-text">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-text/70">{item.label}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {sectorBlocks.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text/72"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Modules"
          title="Features preview grid"
          description="Bu kartlar satis sayfalaridir. Ziyaretciyi operasyon ekranina degil; plan, lisans ve indirme akisina tasir."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featurePreviewGrid.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/70">{item.description}</p>
                <Link href={item.href as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                  Detayi incele
                </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Desktop + Mobile"
          title="Operasyon istemcide, web ise satis ve lisans merkezinde"
          description="Website yalnizca purchase, licensing, downloads ve account management icin vardir. Operational actions sadece Desktop ve Mobile apps icinde gerceklesir."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {ecosystemCards.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Aylik ve yillik lisans modelleri"
          description="Starter, Pro ve Enterprise planlari ile sube, cihaz ve personel limitlerinizi net okuyun."
          action={
            <Link href="/pricing" className="text-sm font-semibold text-brand">
              Tum planlari gor
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-3">
          {pricingPlans.map((plan) => (
            <Card key={plan.code} className={plan.highlight ? "border-brand/30" : undefined}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {plan.code}
              </p>
              <CardTitle className="mt-2">{plan.name}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/70">{plan.summary}</p>
              <p className="mt-5 font-heading text-4xl text-text">
                {new Intl.NumberFormat("tr-TR", {
                  style: "currency",
                  currency: "TRY",
                  maximumFractionDigits: 0
                }).format(plan.monthlyPrice)}
              </p>
              <p className="mt-2 text-sm text-text/55">monthly base</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Licensing flow"
          title="Odeme sonrasi ne olur?"
          description="Checkout sadece bir odeme sayfasi degil; tenant, subscription, license ve download akisinin baslangicidir."
        />
        <div className="grid gap-4 md:grid-cols-5">
          {licensingFlow.map((item, index) => (
            <Card key={item} className="p-5">
              <p className="text-sm font-semibold text-brand">0{index + 1}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <SectionHeading
            eyebrow="Reseller"
            title="Bayi kanali ile recurring revenue kurun"
            description="Perakende yazilimi satan partnerler, saha ekipleri ve bolgesel cozum ortaklari icin basvuru, login ve lisans takibi hazir."
          />
          <div className="mt-5 grid gap-3">
            {resellerBenefits.map((item) => (
              <div key={item} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4 text-sm text-text/72">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/reseller" className="text-brand">
              Bayi sayfasi
            </Link>
            <Link href="/reseller/apply" className="text-text">
              Basvuru formu
            </Link>
          </div>
        </Card>

        <Card>
          <SectionHeading
            eyebrow="Support"
            title="Docs, FAQ ve onboarding destek katmani"
            description="Satisi tek basina birakmayan; lisans teslimi ve aktivasyon surecini tamamlayan bilgi merkezi."
          />
          <div className="mt-5 grid gap-3">
            {supportChannels.map((item) => (
              <div key={item.title} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-text/72">{item.description}</p>
                <Link href={item.href as never} className="mt-3 inline-flex text-sm font-semibold text-brand">
                  Git
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="section-grid rounded-[36px] border border-line bg-white px-6 py-8 md:px-8 md:py-10">
        <SectionHeading
          eyebrow="Final CTA"
          title="Simdi karar verin, webden satin alin ve uygulamada aktive edin"
          description="Buy now, compare plans veya reseller application akislari tek bir ticari merkezde toplandi."
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/checkout?plan=pro&cycle=monthly" className="text-sm font-semibold text-brand">
            Buy now
          </Link>
          <Link href="/pricing" className="text-sm font-semibold text-text">
            Compare plans
          </Link>
          <Link href="/reseller/apply" className="text-sm font-semibold text-text">
            Reseller application
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Commercial engine"
          title="Pricing experience preview"
          description="Aylik ve yillik toggle ile gercek SaaS fiyatlandirma akisini gorebilirsiniz."
        />
        <PricingShowcase />
      </section>
    </>
  );
}
