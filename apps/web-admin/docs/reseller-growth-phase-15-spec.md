# Phase 15 - Reseller Growth System

## 1) reseller system architecture
- Public acquisition starts at `/resellers/apply` and stores partner applications in reseller-growth store.
- Review and channel operations run through admin surfaces (`/admin/resellers`, `/admin/resellers/{id}`).
- Partner execution runs in reseller portal (`/reseller/portal/*`) with separate `leads` and `training` modules.
- Referral, assignment, commission and payout operations are exposed via `/api/reseller-growth/*`.
- CRM lead ownership sync is maintained via `assignLeadToReseller -> crm-store.patch` to keep reseller attribution aligned.
- No POS operations are executed in web/admin/portal routes.

## 2) data models
- `ResellerApplicationRecord`: application lifecycle (`submitted`, `under_review`, `approved`, `rejected`).
- `ResellerProfile`: active partner identity (`resellerId`, `region`, `commissionRate`, `referralCode`, `tier`).
- `ResellerLeadAssignment`: ownership model for lead assignment (auto/manual + audit fields).
- `ReferralVisitRecord` + `ReferralConversionRecord`: channel attribution events.
- `ResellerCommissionRecord`: earned value per trigger (`new_subscription`, `renewal`, `upgrade`).
- `ResellerPayoutRecord`: payout batch with linked commission ids and payment state.
- `ResellerFraudFlag`: misuse markers (`fake_signup`, `self_referral`, `duplicate_account`).
- `ResellerNotificationRecord`: partner-facing operational notifications.

## 3) referral logic
- Each approved reseller receives a unique referral code.
- Tracking endpoint: `POST /api/reseller-growth/referrals/track`.
- Supported events: `visit`, `signup`, `purchase`.
- `purchase` events generate pending commission rows by active commission rule.
- Self-referral and duplicate patterns are flagged in fraud registry.

## 4) commission rules
- Rule engine supports:
  - `percent`
  - `fixed`
  - `tiered` (Bronze/Silver/Gold/Platinum)
- Auto-commission sync for converted CRM leads with reseller attribution.
- Commission statuses:
  - `pending`
  - `approved`
  - `paid`
- Payout flow:
  - create payout batch from approved commissions
  - mark payout paid
  - cascade to commission `paid` state

## 5) dashboard design
- Admin dashboard metrics:
  - total/active resellers
  - pending applications
  - leads generated
  - conversion rate
  - revenue and pending payout totals
- Reseller dashboard metrics:
  - assigned leads
  - conversion metrics
  - pending/paid commissions
  - referral funnel (visit/signup/purchase)
  - tier visibility

## 6) admin controls
- Review queue:
  - approve/reject applications
- Lead assignment:
  - assign lead to reseller with mode (`manual`, `auto_region`, `auto_performance`)
- Reseller detail controls:
  - update status and commission rate
  - approve/mark commission paid
  - create payout batch
  - mark payout paid

## 7) implementation checklist
- [x] Reseller application endpoint + workflow
- [x] Reseller profile model and tier support
- [x] Referral tracking endpoint and counters
- [x] Lead assignment endpoint with CRM sync
- [x] Commission creation and status transitions
- [x] Payout creation and status transitions
- [x] Admin reseller growth panel
- [x] Reseller portal `leads` and `training` modules
- [x] Public reseller form upgraded to phase-15 fields

## 8) scaffold code
- `apps/web-admin/lib/reseller-growth-types.ts`
- `apps/web-admin/lib/reseller-growth-store.ts`
- `apps/web-admin/lib/reseller-growth-service.ts`
- `apps/web-admin/app/api/reseller-growth/applications/route.ts`
- `apps/web-admin/app/api/reseller-growth/applications/[applicationId]/review/route.ts`
- `apps/web-admin/app/api/reseller-growth/dashboard/route.ts`
- `apps/web-admin/app/api/reseller-growth/resellers/route.ts`
- `apps/web-admin/app/api/reseller-growth/resellers/[resellerId]/route.ts`
- `apps/web-admin/app/api/reseller-growth/portal/route.ts`
- `apps/web-admin/app/api/reseller-growth/leads/route.ts`
- `apps/web-admin/app/api/reseller-growth/leads/assign/route.ts`
- `apps/web-admin/app/api/reseller-growth/referrals/track/route.ts`
- `apps/web-admin/app/api/reseller-growth/commissions/route.ts`
- `apps/web-admin/app/api/reseller-growth/commissions/[commissionId]/route.ts`
- `apps/web-admin/app/api/reseller-growth/payouts/route.ts`
- `apps/web-admin/app/api/reseller-growth/payouts/[payoutId]/route.ts`
- `apps/web-admin/components/forms/reseller-apply-form.tsx`
- `apps/web-admin/components/portal/reseller-portal-panels-phase6.tsx`
- `apps/web-admin/components/admin/admin-reseller-growth-panel.tsx`
- `apps/web-admin/components/admin/admin-panels.tsx`
- `apps/web-admin/components/admin/admin-detail-panels.tsx`
- `apps/web-admin/app/reseller/portal/[section]/page.tsx`
- `apps/web-admin/lib/site-content.ts`
