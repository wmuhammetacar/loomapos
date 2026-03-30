import { DownloadIntentForm } from "@/components/forms/download-intent-form";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  getDownloadHighlights,
  marketingPrimaryCtas,
  marketingSecondaryCtas
} from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Indirme Merkezi",
  description:
    "Desktop POS ve Mobile Operations paketleri, surum notlari, kurulum adimlari ve lisans aktivasyon yonlendirmeleri.",
  path: "/download"
});

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Indirme Merkezi"
        title="Desktop POS ve Mobile Operations uygulamalarini guvenle indir"
        description="Web, indirme ve lisans yonetim merkezidir. Uygulamayi indirmek ucretsizdir; canli kullanim icin aktif lisans gerekir. Satis ve odeme sadece Desktop POS tarafinda, Mobile ise operasyon takip ve kontrol icindir."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Paketler"
          title="Her platform icin net kurulum ve aktivasyon"
          description="Her pakette surum, gereksinim, kurulum ve aktivasyon adimlari birlikte sunulur."
        />
        <p className="rounded-2xl border border-line bg-muted/35 px-4 py-3 text-sm font-semibold text-text/80">
          Uygulama dosyasini indirmek ucretsizdir. Canli operasyon icin aktif plan ve lisans zorunludur.
        </p>
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-text/75">
          Web uzerinden kasa satis/odeme islemi yapilmaz. Satis ve odeme Desktop POS tarafinda, Mobile ise saha operasyonu ve izleme icin kullanilir.
        </p>
        <p className="rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
          Deneme aktifken kurulum yapabilirsiniz. Deneme biterse sistem salt-okunur moda gecer; goruntuleme acik kalir, operasyon yazma akislarini yeniden acmak icin plan yukseltmesi gerekir.
        </p>
        <DownloadIntentForm />
        <div className="grid gap-4">
          {getDownloadHighlights().map((artifact) => (
            <Card key={artifact.platform} id={artifact.platform}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <CardTitle>{artifact.title}</CardTitle>
                  <p className="mt-2 text-sm text-text/60">
                    {artifact.version} · {artifact.releaseDate} · {artifact.visibility}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-text/72">{artifact.audience}</p>
                </div>
                <div className="rounded-full border border-line bg-muted/30 px-4 py-2 text-sm font-semibold text-text/72">
                  {artifact.platform.toUpperCase()}
                </div>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-4">
                <InfoList title="Surum Notlari" items={artifact.releaseNotes} />
                <InfoList title="Gereksinimler" items={artifact.requirements} />
                <InfoList title="Kurulum Adimlari" items={artifact.installationSteps} />
                <InfoList title="Aktivasyon Adimlari" items={artifact.activationSteps} />
              </div>
              <MarketingCtaGroup
                items={[
                  {
                    href: artifact.href,
                    label: artifact.platform === "windows" ? "Desktop Uygulamayi Indir" : "Mobile Uygulamayi Indir",
                    variant: "primary"
                  },
                  { href: "/docs/installation", label: "Kurulum Rehberi", variant: "outline" },
                  { href: "/docs/license-activation", label: "Lisans Aktivasyon Dokumani", variant: "ghost" }
                ]}
                context={`download_${artifact.platform}`}
                className="mt-6"
                size="sm"
              />
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingPrimaryCtas} context="download_bottom" />
      </section>
    </>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-text">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-text/72">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
