import Link from "next/link";
import { MarketingCtaGroup } from "@/components/site/marketing-cta-group";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { marketingSecondaryCtas } from "@/lib/marketing-content";
import {
  getMarketingBlogCategoriesServer,
  getMarketingBlogPostsServer,
  getMarketingBlogTagsServer
} from "@/lib/marketing-content-server";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "POS best practices, stock management, retail growth, e-invoice ve reseller content odakli blog merkezi.",
  path: "/blog"
});

export default async function BlogPage() {
  const [categories, tags, posts] = await Promise.all([
    getMarketingBlogCategoriesServer(),
    getMarketingBlogTagsServer(),
    getMarketingBlogPostsServer()
  ]);

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="SEO content engine for organic demand and buyer education"
        description="Publish guides, retail tactics, rollout advice and product updates that internally link to features, pricing, docs and reseller pages."
        actions={marketingSecondaryCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Posts"
          title="Recent articles"
          description="Each post is categorized, tagged and connected to related features and docs."
        />
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <span key={category} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-text/72">
              {category}
            </span>
          ))}
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line bg-muted/40 px-4 py-2 text-sm text-text/68">
              #{tag}
            </span>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.slug}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {post.category}
              </p>
              <CardTitle className="mt-2">{post.title}</CardTitle>
              <p className="mt-3 text-sm leading-6 text-text/72">{post.excerpt}</p>
              <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-text/55">
                <span>{post.publishedAt}</span>
                <span>{post.readTime}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-line bg-muted/30 px-3 py-1 text-xs text-text/65">
                    {tag}
                  </span>
                ))}
              </div>
              <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Read article
              </Link>
            </Card>
          ))}
        </div>
        <MarketingCtaGroup items={marketingSecondaryCtas} context="blog_bottom" />
      </section>
    </>
  );
}
