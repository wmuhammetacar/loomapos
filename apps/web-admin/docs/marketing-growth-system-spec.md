# Marketing Growth System Spec

## 1) Website architecture
- Public growth site owns product explanation, SEO acquisition, pricing evaluation, downloads, reseller acquisition, docs, blog, FAQ, contact and demo flows.
- Customer account access remains in `/portal` and reseller account access remains in `/reseller/portal`.
- The website never executes cashier, stock, branch or other live POS operations.
- Multi-language growth expansion is reserved through `/tr`, `/en`, and `/ar` placeholder routes.

## 2) Route map
- Core growth routes: `/`, `/features`, `/pricing`, `/download`, `/integrations`, `/resellers`, `/demo`, `/docs`, `/faq`, `/contact`, `/blog`.
- SEO landing routes: `/{slug}` for keyword-targeted pages such as `/pos-programi`, `/satis-programi`, `/barkodlu-satis-programi`, `/perakende-pos`, `/restoran-pos`, `/kafe-pos`, `/butik-pos`, `/market-pos`, `/magaza-pos`.
- Solution routes: `/solutions`, `/solutions/{slug}`.
- Feature routes: `/features/{slug}`.
- Competitor routes: `/alternatives`, `/alternatives/{slug}`.
- Integration routes: `/integrations`, `/integrations/{slug}`.
- Documentation routes: `/docs`, `/docs/{slug}`.
- Blog routes: `/blog`, `/blog/{slug}`.
- Trust routes: `/security`, `/status`.
- Legacy reseller paths redirect to canonical plural routes.

## 3) SEO strategy
- Indexable marketing surfaces are declared in `lib/marketing-content.ts` through `publicIndexableRoutes` and the runtime sitemap builder.
- Canonical metadata is generated through `lib/seo.ts`.
- Sitemap generation is deduplicated and reads runtime content in `app/sitemap.ts`.
- Robots rules exclude portals, auth flows, checkout surfaces and API routes in `app/robots.ts`.
- Blog posts include categories, tags, metadata and related-post linking.
- Docs, features, alternatives and SEO landing pages use dedicated slugs instead of query-based routing.
- Schema placeholders exist through software and article schema helpers.

## 4) Page templates
- Hero + CTA layout: homepage, pricing, download, demo, reseller and SEO landing pages.
- Collection index layout: `/features`, `/solutions`, `/integrations`, `/alternatives`, `/docs`, `/blog`.
- Detail content layout: feature detail, solution detail, alternative detail, docs article and blog article pages.
- Lead capture layout: `/contact`, `/demo`, `/resellers/apply`.
- Trust layout: `/security`, `/status`.

## 5) Content structure
- Structured content source-of-truth lives in `lib/marketing-content.ts`.
- Runtime content loading lives in `lib/marketing-content-server.ts` and reads `.marketing-data/marketing-content-snapshot.json` when present.
- Content collections include feature pages, solution pages, SEO landing pages, comparison pages, integrations, docs pages and marketing blog posts.
- Runtime content-management foundation exists through `app/api/marketing/content/route.ts` and is consumed directly by the content-driven public routes.
- Download artifacts and pricing highlights are normalized for reusable page sections and CTA blocks.

## 6) Conversion strategy
- Primary CTA families are `Start Free Trial`, `Buy License`, `Download Desktop`, `Download Mobile`, `Request Demo` and `Become a Reseller`.
- CTA groups are standardized through `components/site/marketing-cta-group.tsx`.
- Contact and demo forms submit leads through `lib/marketing-service.ts` and `/api/marketing/leads`.
- Reseller acquisition uses `/resellers` and `/resellers/apply`, with analytics tracking on successful application submit.
- Download routes connect evaluation traffic to installation and activation docs without mixing the public site with the customer portal.

## 7) Analytics integration
- Page views are tracked by `components/site/marketing-analytics-provider.tsx`.
- CTA clicks are tracked in `components/site/marketing-cta-group.tsx` and `components/site/public-header.tsx`.
- Lead submissions are tracked in `lib/marketing-service.ts` and reseller apply form flow.
- Traffic source foundation captures `utm_source`, `utm_medium`, `utm_campaign` and referrer data.
- Marketing event persistence is available in `/api/marketing/events`.
- Lead persistence for sales follow-up is available in `/api/marketing/leads`.

## 8) Implementation checklist
- Homepage, pricing, features, download and demo pages implemented.
- SEO landing pages implemented.
- Industry solution pages implemented.
- Feature detail pages implemented.
- Competitor comparison pages implemented.
- Integrations pages implemented.
- Blog system with categories, tags and related posts implemented.
- Documentation system with setup, install, activation and troubleshooting content implemented.
- Lead capture flows implemented for contact, demo and reseller onboarding.
- Analytics tracking and sitemap/robots/canonical foundations implemented.
- Trust pages and locale-expansion placeholders implemented.
- Runtime content snapshot support implemented for content-driven route families.

## 9) Scaffold code
- Content model: `lib/marketing-content.ts`
- Runtime content loader: `lib/marketing-content-server.ts`
- SEO utilities: `lib/seo.ts`
- Marketing tracking and lead service: `lib/marketing-service.ts`
- Analytics provider: `components/site/marketing-analytics-provider.tsx`
- CTA system: `components/site/marketing-cta-group.tsx`
- Header and footer shells: `components/site/public-header.tsx`, `components/site/public-footer.tsx`
- Lead forms: `components/forms/marketing-lead-form.tsx`, `components/forms/reseller-apply-form.tsx`
- Marketing APIs: `app/api/marketing/leads/route.ts`, `app/api/marketing/events/route.ts`, `app/api/marketing/content/route.ts`
- Route families: `app/(public)/*`
