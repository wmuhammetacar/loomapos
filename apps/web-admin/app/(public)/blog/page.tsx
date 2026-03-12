import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SectionHeading } from "@/components/site/section-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { blogPosts, globalCtas } from "@/lib/site-content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "POS best practices, stock management, retail growth, e-invoice ve reseller content odakli blog merkezi.",
  path: "/blog"
});

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="SEO ve conversion icin icerik motoru"
        description="Sektor bazli landing makaleleri, perakende buyume icerikleri ve reseller odakli yayinlar ile ticari talep yaratma katmani."
        actions={globalCtas}
      />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Posts"
          title="Son yayinlar"
          description="Her makale features, pricing, docs ve reseller akislariyla ic linklenir."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {blogPosts.map((post) => (
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
              <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex text-sm font-semibold text-brand">
                Yaziyi oku
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
