# Phase 13 Onboarding and Activation System Spec

## 1) Onboarding architecture
- Entry rule: onboarding starts after subscription purchase or trial activation.
- Primary customer route: `/portal/onboarding`.
- Reseller guidance route: `/reseller/portal/onboarding`.
- Boundary rule: portal guides activation and readiness only; operational POS actions remain in Desktop/Mobile apps.
- Persistent resume behavior: onboarding progress state is stored per tenant and restored on re-entry.
- Conversion target: first successful sale confirmation tracked from onboarding dashboard.

## 2) Step-by-step onboarding flow
1. Complete company profile (`/portal/company`)
2. Download Desktop POS (`/portal/downloads`)
3. Activate license (`/portal/licenses`)
4. Register first device (`/portal/devices`)
5. Create first branch (guided docs)
6. Add first product (manual or spreadsheet import guided docs)
7. Create first staff member (guided docs)
8. Complete first test sale (guided flow + confirmation in onboarding dashboard)

Flow notes:
- Each step has status (`pending`, `complete`, `attention`), explanation and action CTA.
- For app-side steps without direct portal telemetry, user can confirm completion from dashboard.
- Trial users see remaining days and upgrade prompts during onboarding.

## 3) Onboarding dashboard structure
- Route shell: customer portal shell + onboarding panel component.
- Dashboard sections:
  - Progress summary (completion ratio + percentage)
  - 8-step checklist cards
  - First-sale simulation sequence
  - Onboarding analytics signals block
  - Automated email guidance block
  - Assistance links (video, docs, support, status)
  - Common error handling guidance
  - Completion success block with quick links
- Reseller onboarding dashboard:
  - profile readiness
  - referral readiness
  - asset readiness
  - support readiness

## 4) Analytics metrics
- Metrics exposed in onboarding dashboard:
  - completed steps
  - pending steps
  - local step completion events
  - first sale status
  - profile setup status
  - desktop installation status
  - device activation count
  - first product status
- Event collection foundation:
  - API route: `/api/onboarding/events`
  - Captures `resume`, `step_completed`, `step_reopened`
  - Persists events to `.onboarding-data/onboarding-events.json`
  - Returns aggregate counts by step

## 5) Email automation flow
- Email 1: Welcome to LoomaPOS
  - Trigger: purchase/trial entry into onboarding
- Email 2: Install Desktop POS
  - Trigger: profile step progression
- Email 3: Add your first product
  - Trigger: after first device activation
- Email 4: Complete your first sale
  - Trigger: after first product step
- Dashboard displays email plan status (`sent`, `scheduled`, `pending`, `urgent`) and links to relevant guides.

## 6) Implementation checklist
- Completed:
  - customer onboarding dashboard at `/portal/onboarding`
  - canonical 8-step onboarding checklist
  - trial reminder and upgrade guidance
  - first-sale simulation and completion confirmation
  - onboarding assistance and error-handling guidance
  - onboarding analytics event API scaffold
  - product import template asset
  - customer login default redirect to onboarding
  - success page onboarding handoff link
  - reseller onboarding route, nav exposure and guidance panel
- Acceptance alignment:
  - onboarding dashboard exists
  - progress checklist works
  - company/license/device guidance exists
  - branch/product/staff/first-sale guidance exists
  - onboarding completion state exists
  - onboarding analytics foundation exists

## 7) Onboarding UI components
- Customer onboarding component:
  - `apps/web-admin/components/portal/onboarding-activation-dashboard.tsx`
- Customer portal integration:
  - `apps/web-admin/components/portal/customer-portal-panels-phase6.tsx`
- Reseller onboarding integration:
  - `apps/web-admin/components/portal/reseller-portal-panels-phase6.tsx`
  - `apps/web-admin/app/reseller/portal/[section]/page.tsx`
- Navigation and route exposure:
  - `apps/web-admin/lib/site-content.ts`
  - `apps/web-admin/components/patterns/navigation-patterns.tsx`
- Onboarding analytics endpoint:
  - `apps/web-admin/app/api/onboarding/events/route.ts`
- Import template asset:
  - `apps/web-admin/public/templates/product-import-template.csv`
