import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SchemaScript } from "@/components/site/schema-script";
import { ScreenshotGallery } from "@/components/site/screenshot-gallery";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import {
  customerLogoPlaceholders,
  homeStats,
  marketingPrimaryCtas,
  marketingSecondaryCtas,
  testimonialPlaceholders,
  trustSignals
} from "@/lib/marketing-content";
import {
  getIntegrationPagesServer,
  getMarketingFeaturesServer,
  getSeoLandingPagesServer,
  getSolutionPagesServer
} from "@/lib/marketing-content-server";
import { buildMetadata, buildSoftwareSchema } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "POS SaaS growth website",
  description:
    "LoomaPOS is a premium POS SaaS marketing website built to convert organic traffic into subscriptions, downloads, demos and reseller applications.",
  path: "/"
});

export default async function HomePage() {
  const [seoLandingPages, marketingFeatures, solutionPages, integrationHighlights] =
    await Promise.all([
      getSeoLandingPagesServer(),
      getMarketingFeaturesServer(),
      getSolutionPagesServer(),
      getIntegrationPagesServer()
    ]);

  return (
    <>
      <SchemaScript schema={buildSoftwareSchema()} />

      <PageHero
        eyebrow="Growth Engine"
        title="Search-ready POS SaaS website for subscriptions, demos, downloads and reseller growth."
        description="LoomaPOS turns the website into the acquisition layer: keyword landing pages, feature pages, pricing clarity, docs, demo requests and download guidance. Live POS operations stay inside Desktop and Mobile apps."
        actions={marketingPrimaryCtas}
        aside={
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Critical product rule
            </p>
            <p className="text-lg font-semibold">
              The website never becomes a cashier, stock or branch operations interface.
            </p>
            <ul className="space-y-2 text-sm leading-6 text-white/75">
              <li>Explain the product clearly</li>
              <li>Convert visitors into subscribers</li>
              <li>Distribute Desktop and Mobile apps</li>
              <li>Route users to the correct portal</li>
            </ul>
          </div>
        }
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Trust"
          title="Built as a premium SaaS acquisition surface"
          description="Traffic capture, conversion clarity and product trust all start here before the customer ever reaches a portal or downloads an app."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {homeStats.map((item) => (
            <Card key={item.label}>
              <p className="font-heading text-4xl font-bold text-text">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-text/70">{item.label}</p>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {trustSignals.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="SEO Clusters"
          title="Landing pages for high-intent POS keywords"
          description="Industry and keyword pages capture organic demand, then route visitors toward pricing, demo and download actions."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {seoLandingPages.slice(0, 6).map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/70">{item.description}</p>
              <Link href={`/${item.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Open landing page
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Features"
          title="Feature pages that teach, rank and convert"
          description="Each feature detail page explains what the product does, how it works in Desktop and Mobile, and why the business should care."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {marketingFeatures.slice(0, 6).map((item) => (
            <Card key={item.slug}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.summary}</p>
              <Link href={`/features/${item.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Read feature page
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Solutions"
          title="Industry pages aligned to real business pain"
          description="Retail, restaurant, cafe, market and boutique pages connect operational realities to the right plan, features and setup guidance."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {solutionPages.map((item) => (
            <Card key={item.slug}>
              <CardTitle>{item.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{item.description}</p>
              <Link href={`/solutions/${item.slug}` as never} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Explore solution
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Screenshots"
          title="Product visuals reinforce trust without turning the site into the app"
          description="Visual placeholders make Desktop and Mobile capabilities concrete while preserving the rule that the website is not the operational surface."
        />
        <ScreenshotGallery items={seoLandingPages[0]?.screenshots ?? []} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <SectionHeading
            eyebrow="Integrations"
            title="Integration content that builds confidence"
            description="Integration pages help the website rank for connected-tool queries while keeping the actual workflows inside Desktop and Mobile."
          />
          <div className="mt-5 grid gap-3">
            {integrationHighlights.map((item) => (
              <div key={item.slug} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4 text-sm text-text/72">
                <p className="font-semibold text-text">{item.title}</p>
                <p className="mt-2">{item.description}</p>
              </div>
            ))}
          </div>
          <MarketingCtaGroup items={marketingSecondaryCtas} context="home_integrations" className="mt-6" />
        </Card>

        <Card>
          <SectionHeading
            eyebrow="Proof"
            title="Testimonials and customer proof placeholders"
            description="Trust blocks are ready for customer logos, testimonials and future case studies."
          />
          <div className="mt-5 grid gap-3">
            {testimonialPlaceholders.map((item) => (
              <div key={item.quote} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="text-sm leading-6 text-text/72">&ldquo;{item.quote}&rdquo;</p>
                <p className="mt-3 text-sm font-semibold text-text">{item.author}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-text/55">{item.company}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="section-grid rounded-[36px] border border-line bg-white px-6 py-8 md:px-8 md:py-10">
        <SectionHeading
          eyebrow="Proof Library"
          title="Customer logos, docs and app downloads strengthen the conversion path"
          description="Visitors should always have another trust-building step before purchase: read docs, request a demo or review app delivery details."
        />
        <div className="mt-6 flex flex-wrap gap-3">
          {customerLogoPlaceholders.map((item) => (
            <span key={item} className="rounded-full border border-line bg-muted/30 px-4 py-2 text-sm font-semibold text-text/72">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-white px-6 py-8 md:px-8 md:py-10">
        <SectionHeading
          eyebrow="Primary CTA"
          title="Turn search traffic into demos, trials and subscriptions"
          description="Core CTAs repeat consistently across the site: start free trial, buy license, request demo, download the apps or become a reseller."
        />
        <MarketingCtaGroup items={[...marketingPrimaryCtas, ...marketingSecondaryCtas]} context="home_final_cta" className="mt-6" />
      </section>
    </>
  );
}
