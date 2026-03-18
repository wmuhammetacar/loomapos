import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
import { resellerBenefits, resellerJourney } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Reseller program",
  description:
    "Explore the LoomaPOS reseller program, partner benefits, onboarding flow and application path.",
  path: "/resellers"
});

export default function ResellersPage() {
  return (
    <>
      <PageHero
        eyebrow="Resellers"
        title="Partner growth surface for resellers and regional rollout teams"
        description="The reseller program page explains benefits, onboarding and portal entry without ever prioritizing customer checkout over partner intent."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Benefits"
          title="Why partners join the program"
          description="Use this page to attract partners, collect inquiries and route approved resellers into the correct portal."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {resellerBenefits.map((item) => (
            <Card key={item} className="text-sm leading-6 text-text/72">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Journey"
          title="Partner onboarding flow"
          description="Reseller growth requires a structured path from application to approval to portal usage."
        />
        <div className="grid gap-4 md:grid-cols-4">
          {resellerJourney.map((item, index) => (
            <Card key={item}>
              <p className="text-sm font-semibold text-brand">0{index + 1}</p>
              <p className="mt-3 text-sm leading-6 text-text/72">{item}</p>
            </Card>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/resellers/apply" className="text-brand">
            Apply now
          </Link>
          <Link href="/reseller/login" className="text-text">
            Reseller login
          </Link>
        </div>
      </section>

      <MarketingCtaGroup items={marketingSecondaryCtas} context="resellers_bottom" />
    </>
  );
}
