import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SchemaScript } from "@/components/site/schema-script";
import { Card } from "@/components/ui/card";
import { marketingPrimaryCtas } from "@/lib/marketing-content";
import {
  getMarketingBlogPostBySlugServer,
  getRelatedDocsServer,
  getRelatedFeaturesServer,
  getRelatedPostsServer
} from "@/lib/marketing-content-server";
import { buildArticleSchema, buildMetadata } from "@/lib/seo";

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = await getMarketingBlogPostBySlugServer(slug);

  return buildMetadata({
    title: post?.title ?? "Blog detail",
    description: post?.excerpt ?? "Blog detail sayfasi.",
    path: `/blog/${slug}`
  });
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = await getMarketingBlogPostBySlugServer(slug);

  if (!post) {
    notFound();
  }

  const [relatedFeatures, relatedDocs, relatedPosts] = await Promise.all([
    getRelatedFeaturesServer(post.relatedFeatureSlugs),
    getRelatedDocsServer(post.relatedDocSlugs),
    getRelatedPostsServer(post.slug)
  ]);

  return (
    <>
      <SchemaScript
        schema={buildArticleSchema({
          title: post.title,
          description: post.excerpt,
          path: `/blog/${post.slug}`,
          publishedAt: post.publishedAt,
          section: post.category,
          keywords: post.tags
        })}
      />
      <PageHero
        eyebrow={post.category}
        title={post.title}
        description={post.excerpt}
      />
      <div className="flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-line bg-muted/30 px-3 py-1 text-xs text-text/65">
            {tag}
          </span>
        ))}
      </div>
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
        <Card>
          <h2 className="font-heading text-2xl font-semibold text-text">Related features</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-brand">
            {relatedFeatures.map((item) => (
              <Link key={item.slug} href={`/features/${item.slug}` as never}>
                {item.title}
              </Link>
            ))}
          </div>
          <h2 className="mt-6 font-heading text-2xl font-semibold text-text">Related docs</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-brand">
            {relatedDocs.map((item) => (
              <Link key={item.slug} href={`/docs/${item.slug}` as never}>
                {item.title}
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-heading text-2xl font-semibold text-text">Read next</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {relatedPosts.map((item) => (
              <div key={item.slug} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="text-sm font-semibold text-text">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-text/72">{item.excerpt}</p>
                <Link href={`/blog/${item.slug}` as never} className="mt-4 inline-flex text-sm font-semibold text-brand">
                  Open
                </Link>
              </div>
            ))}
          </div>
        </Card>
        <MarketingCtaGroup items={marketingPrimaryCtas} context={`blog_${post.slug}_bottom`} />
      </div>
    </>
  );
}
