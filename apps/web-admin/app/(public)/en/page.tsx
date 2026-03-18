import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "English locale foundation",
    description: "English locale route foundation for future multi-language marketing expansion.",
    path: "/en"
  }),
  robots: { index: false, follow: true }
};

export default function EnglishLocalePage() {
  return (
    <>
      <PageHero
        eyebrow="Locale foundation"
        title="English locale placeholder"
        description="This route reserves the /en namespace for future translated marketing, documentation and growth content."
      />
      <Card>
        <p className="text-sm leading-6 text-text/72">
          The current production-ready marketing experience remains on the default public routes. This page exists to lock the multi-language foundation in the route architecture.
        </p>
        <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-brand">
          Return to homepage
        </Link>
      </Card>
    </>
  );
}
