import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { getLegalBySlug, legalDocuments } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return legalDocuments.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: LegalPageProps) {
  const { slug } = await params;
  const document = getLegalBySlug(slug);

  return buildMetadata({
    title: document?.title ?? "Legal",
    description: document?.summary ?? "Legal dokuman.",
    path: `/legal/${slug}`
  });
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const document = getLegalBySlug(slug);

  if (!document) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={document.title}
        description={document.summary}
      />
      <div className="space-y-6">
        {document.sections.map((section) => (
          <Card key={section.heading}>
            <h2 className="font-heading text-2xl font-semibold text-text">{section.heading}</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-text/72">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
