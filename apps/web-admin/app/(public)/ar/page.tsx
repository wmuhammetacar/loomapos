import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Arabic locale foundation",
    description: "Arabic locale route placeholder for future multi-language marketing expansion.",
    path: "/ar"
  }),
  robots: { index: false, follow: true }
};

export default function ArabicLocalePage() {
  return (
    <>
      <PageHero
        eyebrow="Locale foundation"
        title="Arabic locale placeholder"
        description="This placeholder route locks the /ar namespace for future right-to-left marketing and documentation expansion."
      />
      <Card>
        <p className="text-sm leading-6 text-text/72">
          Locale-specific Arabic content is intentionally reserved for a future translation phase. The route exists now so expansion does not create structural chaos later.
        </p>
        <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-brand">
          Return to homepage
        </Link>
      </Card>
    </>
  );
}
