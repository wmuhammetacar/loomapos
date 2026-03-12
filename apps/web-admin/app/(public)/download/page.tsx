import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { downloadArtifacts, globalCtas } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Download center",
  description:
    "Windows Desktop App, Android ve iOS dagitim bilgileri, release notes, kurulum ve aktivasyon adimlari.",
  path: "/download"
});

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Download center"
        title="Windows, Android ve iOS uygulama dagitimi"
        description="Public katmanda release notes, sistem gereksinimleri ve kurulum notlari gorunur. Lisansli kurulum paketleri musteri portali ile birlikte teslim edilir."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Artifacts"
          title="App download hub"
          description="Her platform icin versiyon, release date, activation guide ve minimum sistem gereksinimi birlikte sunulur."
        />
        <div className="grid gap-4">
          {downloadArtifacts.map((artifact) => (
            <Card key={artifact.platform}>
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
                <InfoList title="Release notes" items={artifact.releaseNotes} />
                <InfoList title="Requirements" items={artifact.requirements} />
                <InfoList title="Installation guide" items={artifact.installationSteps} />
                <InfoList title="Activation guide" items={artifact.activationSteps} />
              </div>
            </Card>
          ))}
        </div>
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
