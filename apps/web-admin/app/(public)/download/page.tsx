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
        title="Structured app delivery for Desktop and Mobile"
        description="The download center presents system requirements, installation guidance, version notes and activation instructions without confusing public downloads with licensed portal delivery."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Artifacts"
          title="App download hub"
          description="Each platform has a clear artifact, version, update notes, install flow and activation expectation."
        />
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
                <InfoList title="Release notes" items={artifact.releaseNotes} />
                <InfoList title="Requirements" items={artifact.requirements} />
                <InfoList title="Installation guide" items={artifact.installationSteps} />
                <InfoList title="Activation guide" items={artifact.activationSteps} />
              </div>
              <MarketingCtaGroup
                items={[
                  { href: artifact.href, label: artifact.platform === "windows" ? "Download Desktop" : "Download Mobile", variant: "primary" },
                  { href: "/docs/installation", label: "Installation Guide", variant: "outline" },
                  { href: "/docs/license-activation", label: "Activation Docs", variant: "ghost" }
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
