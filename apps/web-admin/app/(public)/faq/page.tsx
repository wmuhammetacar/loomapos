import { PageHero } from "@/components/site/page-hero";
import { SchemaScript } from "@/components/site/schema-script";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { faqCategories, globalCtas } from "@/lib/site-content";
import { buildFaqSchema, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "FAQ",
  description:
    "Pricing, licenses, downloads, activation, devices, billing, reseller, e-invoice ve fiscal integration sorulari.",
  path: "/faq"
});

export default function FaqPage() {
  return (
    <>
      <SchemaScript schema={buildFaqSchema(faqCategories.flatMap((group) => group.items))} />
      <PageHero
        eyebrow="FAQ"
        title="Sik sorulan ticari ve aktivasyon sorulari"
        description="FAQ sayfasi ziyaretcinin fiyat, lisans, indirme ve bayi konularindaki sorularini web katmaninda yanitlar."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Question groups"
          title="Kategori bazli cevaplar"
          description="Her kategori donusumu arttirmak ve destek yogunlugunu azaltmak icin ayrildi."
        />
        <div className="grid gap-4">
          {faqCategories.map((category) => (
            <Card key={category.slug}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {category.title}
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {category.items.map((item) => (
                  <div key={item.question} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                    <p className="font-semibold text-text">{item.question}</p>
                    <p className="mt-3 text-sm leading-6 text-text/72">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
