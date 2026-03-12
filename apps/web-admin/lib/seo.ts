import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-content";

const defaultKeywords = [
  "POS SaaS",
  "perakende yazilimi",
  "lisans yonetimi",
  "masaustu POS",
  "mobil POS",
  "bayi programi",
  "abonelik yazilimi"
];

interface MetadataInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}

export function buildMetadata({
  title,
  description,
  path,
  keywords = []
}: MetadataInput): Metadata {
  const fullTitle = `${title} | ${siteConfig.name}`;
  const url = `${siteConfig.baseUrl}${path}`;

  return {
    title: fullTitle,
    description,
    keywords: [...defaultKeywords, ...keywords],
    alternates: {
      canonical: url
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.name,
      locale: "tr_TR",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description
    }
  };
}

export function buildFaqSchema(
  items: ReadonlyArray<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

export function buildBreadcrumbSchema(
  items: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.baseUrl}${item.path}`
    }))
  };
}

export function buildSoftwareSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Windows, Android, iOS",
    description: siteConfig.description,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "1490",
      highPrice: "5990",
      priceCurrency: "TRY"
    }
  };
}
