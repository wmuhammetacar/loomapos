import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { marketingPrimaryCtas, marketingSecondaryCtas } from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "System status",
  description:
    "Public status placeholder for uptime, release health and operational confidence messaging on the LoomaPOS marketing website.",
  path: "/status"
});

const statusBlocks = [
  {
    title: "Website availability",
    body: "Marketing pages, docs and download guidance are expected to remain fast and reachable for acquisition traffic."
  },
  {
    title: "Portal access",
    body: "Customer and reseller portals remain distinct access surfaces for licensing, downloads and account visibility."
  },
  {
    title: "Operational apps",
    body: "Desktop and Mobile apps continue to own store execution. This page exists only to communicate confidence and transparency."
  }
] as const;

export default function StatusPage() {
  return (
    <>
      <PageHero
        eyebrow="Status"
        title="Operational confidence page for buyers, customers and partners"
        description="This status surface supports trust, uptime messaging and incident transparency without mixing operational workflows into the website."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Availability"
          title="Public confidence blocks"
          description="Use this page for uptime messaging, maintenance visibility and system-level trust communication."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {statusBlocks.map((item) => (
            <Card key={item.title}>
              <p className="text-sm font-semibold text-text">{item.title}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="status_bottom" />
    </>
  );
}
