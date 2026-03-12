import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui/card";
import { blogPosts, getBlogBySlug } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = getBlogBySlug(slug);

  return buildMetadata({
    title: post?.title ?? "Blog detail",
    description: post?.excerpt ?? "Blog detail sayfasi.",
    path: `/blog/${slug}`
  });
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = getBlogBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow={post.heroLabel}
        title={post.title}
        description={post.excerpt}
      />
      <div className="space-y-6">
        {post.sections.map((section) => (
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
