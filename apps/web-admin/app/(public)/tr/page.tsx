import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Turkce locale foundation",
    description: "Turkce locale route foundation for future multi-language marketing expansion.",
    path: "/tr"
  }),
  robots: { index: false, follow: true }
};

export default function TurkishLocalePage() {
  return (
    <>
      <PageHero
        eyebrow="Locale foundation"
        title="Turkce locale hazirligi"
        description="Bu route, gelecekte /tr altinda tam Turkce bilgi mimarisi kurulmasi icin ayrildi. Su an ana public site varsayilan TR deneyimidir."
      />
      <Card>
        <p className="text-sm leading-6 text-text/72">
          Varsayilan marketing deneyimi zaten Turkce odaklidir. Tam locale namespace genislemesi sonraki icerik asamasinda tamamlanacaktir.
        </p>
        <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-brand">
          Ana siteye don
        </Link>
      </Card>
    </>
  );
}
