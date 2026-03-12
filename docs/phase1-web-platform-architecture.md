# Phase 1 Web Platform Architecture

## Architecture summary

`apps/web-admin` artik operasyonel admin panel degil, ticari web platformudur.

- Public layer:
  - Home, features, pricing, download, reseller, docs, FAQ, blog, auth, checkout, success, legal
  - Amac: visitor acquisition, product explanation, subscription conversion, reseller acquisition
- Customer portal:
  - Subscription, licenses, downloads, billing, devices metadata
  - Amac: post-purchase account management
- Reseller portal:
  - Customers, commissions, license-ready customers
  - Amac: reseller acquisition sonrasi metadata visibility
- Prohibited on web:
  - cashier
  - live sales
  - inventory editing
  - branch operations
  - employee operational panels
  - live store reporting workflows

## Route tree

```text
/
/features
/features/sales
/features/inventory
/features/reporting
/features/staff
/features/branches
/features/collections
/features/variants
/features/einvoice
/features/fiscal
/features/dashboard
/pricing
/download
/reseller
/reseller/apply
/reseller/login
/reseller/portal
/reseller/portal/customers
/reseller/portal/commissions
/reseller/portal/licenses
/docs
/faq
/blog
/blog/[slug]
/login
/register
/checkout
/success
/portal
/portal/licenses
/portal/subscription
/portal/downloads
/portal/billing
/portal/devices
/contact
/about
/legal/terms
/legal/privacy
/legal/kvkk
/legal/cookies
```

## Schema design

Core commercial entities:

- `customers`
  - `id`
  - `tenant_id`
  - `full_name`
  - `company_name`
  - `email`
  - `phone`
  - `status`
  - `created_at`
- `subscriptions`
  - `id`
  - `tenant_id`
  - `plan_code`
  - `billing_cycle`
  - `status`
  - `current_period_start`
  - `current_period_end`
  - `reseller_code`
- `licenses`
  - `id`
  - `tenant_id`
  - `subscription_id`
  - `license_key`
  - `plan_code`
  - `issued_at`
  - `expires_at`
  - `status`
  - `device_limit`
  - `feature_flags`
- `billing_records`
  - `id`
  - `tenant_id`
  - `subscription_id`
  - `invoice_no`
  - `provider`
  - `payment_method`
  - `amount`
  - `currency`
  - `status`
  - `issued_at`
  - `paid_at`
- `reseller_leads`
  - `id`
  - `full_name`
  - `company_name`
  - `city`
  - `phone`
  - `email`
  - `website_or_social_proof`
  - `experience`
  - `message`
  - `status`
  - `referral_code`
  - `created_at`

Supporting entities:

- `device_activations`
- `download_artifacts`
- `reseller_commissions`
- `checkout_receipts`

## Page content map

- Home:
  - Hero
  - Trust + sector proof
  - Feature preview grid
  - Desktop/Mobile ecosystem clarification
  - Pricing teaser
  - Licensing flow
  - Reseller section
  - Support section
  - Final CTA
- Features:
  - Hero
  - Pain point
  - Solution explanation
  - Desktop use case
  - Mobile use case
  - Screenshot placeholders
  - Integration notes
  - CTA trio
- Pricing:
  - Monthly / yearly toggle
  - Plan cards
  - Plan comparison
  - License explanation
  - What happens after purchase
  - FAQ
- Checkout:
  - Plan selection
  - Billing cycle
  - Account creation/login
  - Billing info
  - Payment method
  - Order summary
  - Purchase confirmation
- Success:
  - Tenant/company
  - Plan
  - Billing period
  - License key
  - Expiry
  - Device limit
  - Next steps
- Customer portal:
  - Overview
  - Subscription
  - Licenses
  - Downloads
  - Billing
  - Devices
- Reseller:
  - Landing
  - Apply
  - Login
  - Portal
- Content engine:
  - Docs
  - FAQ
  - Blog
  - Legal

## Reusable components

- `PublicShell`
- `PublicHeader`
- `PublicFooter`
- `PageHero`
- `SectionHeading`
- `PricingShowcase`
- `PortalShell`
- `PortalGate`
- `CustomerLoginForm`
- `RegisterForm`
- `CheckoutForm`
- `SuccessPanel`
- `ResellerApplyForm`
- `ResellerLoginForm`
- `CustomerPortalPanels`
- `ResellerPortalPanels`

## Implementation plan

1. Global design system, SEO helpers, public shell
2. Marketing routes and feature architecture
3. Customer auth and portal shell
4. Checkout, success, license delivery
5. Customer portal modules
6. Reseller apply/login/portal
7. Docs, FAQ, blog, legal
8. Build verification and smoke coverage

## Acceptance checklist

- Visitor urunu ticari olarak anlayabiliyor
- Monthly / yearly plan comparison calisiyor
- Purchase sonrasi license access gosteriliyor
- Desktop / Mobile app download center mevcut
- Reseller application form mevcut
- Customer portal subscription/license/download/billing/devices metadata gosteriyor
- Web katmaninda operasyonel POS davranisi yok
