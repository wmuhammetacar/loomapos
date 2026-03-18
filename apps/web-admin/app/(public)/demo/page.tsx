import { MarketingLeadForm } from "@/components/forms/marketing-lead-form";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { ScreenshotGallery } from "@/components/site/screenshot-gallery";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import {
  marketingPrimaryCtas,
  marketingSecondaryCtas,
  seoLandingPages
} from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Product demo",
  description:
    "Request a LoomaPOS demo and review product walkthroughs, screenshots and example workflows.",
  path: "/demo"
});

const demoWorkflows = [
  "Website visitor reviews features, pricing and solution pages.",
  "Sales or partner team qualifies the request through the demo form.",
  "Prospect sees Desktop and Mobile workflow examples and moves into trial or purchase."
] as const;

export default function DemoPage() {
  return (
    <>
      <PageHero
        eyebrow="Demo"
        title="Turn demo requests into guided product understanding"
        description="The demo page shows the product story, UI placeholders, example workflows and a direct path to request a tailored walkthrough."
        actions={marketingSecondaryCtas}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <Card>
          <SectionHeading
            eyebrow="Demo video"
            title="Video placeholder"
            description="A future embedded video can live here to explain how the website, portal and apps work together."
          />
          <div className="mt-6 flex h-64 items-center justify-center rounded-[24px] border border-dashed border-line bg-gradient-to-br from-white via-muted/45 to-accent/10 text-sm font-semibold text-text/55">
            Demo video placeholder
          </div>
        </Card>
        <MarketingLeadForm
          type="demo"
          title="Request a product demo"
          description="Share your business context and tell us what you want to see. The lead is stored for sales follow-up and conversion tracking."
          submitLabel="Request Demo"
          sourcePath="/demo"
        />
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Example workflows"
          title="What the demo should make obvious"
          description="The demo exists to reduce confusion and accelerate purchase readiness."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {demoWorkflows.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screenshots"
          title="Desktop and Mobile preview"
          description="Use visuals to support the story while preserving the product rule that the website does not run POS operations."
        />
        <ScreenshotGallery items={seoLandingPages[0].screenshots} />
      </section>

      <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="demo_bottom" />
    </>
  );
}
