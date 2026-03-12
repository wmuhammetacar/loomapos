import { PageHero } from "@/components/site/page-hero";
import { PricingShowcase } from "@/components/site/pricing-showcase";
import { SchemaScript } from "@/components/site/schema-script";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { globalCtas, pricingFaq } from "@/lib/site-content";
import { buildFaqSchema, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Starter, Pro ve Enterprise planlarini aylik veya yillik olarak karsilastirin. Satin alma tamamlandiginda lisans ve portal erisimi olusur.",
  path: "/pricing"
});

export default function PricingPage() {
  return (
    <>
      <SchemaScript schema={buildFaqSchema(pricingFaq)} />
      <PageHero
        eyebrow="Pricing"
        title="Gercek SaaS fiyatlandirma deneyimi"
        description="Aylik veya yillik paket secin, limitsiz degil kontrollu lisans mantigi ile satin alin. Odeme sonrasi portal, lisans ve indirme erisimi olusur."
        actions={globalCtas}
      />

      <PricingShowcase />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading
            eyebrow="Trust badges"
            title="What happens after purchase"
            description="Tenant olusur, customer account acilir, subscription ve billing record kaydedilir, license key uretilir ve uygulama linkleri gorunur."
          />
        </Card>
        <Card>
          <SectionHeading
            eyebrow="License explanation"
            title="Lisans mantigi plandan bagimsiz net okunur"
            description="Her plan cihaz, sube ve personel limiti ile gelir. Web katmani limitleri gosterir; enforcement istemci aktivasyonunda uygulanir."
          />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="FAQ"
          title="Pricing sorulari"
          description="Karar vermeden once en kritik ticari sorularin net cevaplari."
        />
        <div className="grid gap-4">
          {pricingFaq.map((item) => (
            <Card key={item.question}>
              <p className="font-semibold text-text">{item.question}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
