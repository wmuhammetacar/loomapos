# Phase 7 Internal Operations Platform

## 1. Architecture summary

Phase 7 adds an internal-only operations console under `/admin` for company staff. It is separated from customer and reseller portals and remains non-operational for store POS activity. The internal surface focuses on tenant diagnosis, billing/license/device oversight, reseller oversight, sync/dead-letter visibility, release governance, feature flags, coupon/campaign visibility, notices, and security posture.

## 2. Internal role model

- `super_admin`
- `ops_admin`
- `support_agent`
- `billing_admin`
- `reseller_manager`
- `release_manager`
- `security_auditor`
- `read_only_analyst`

Current scaffold uses a local internal session in `web-admin` and forwards `X-Internal-Role` / `X-Internal-Email` headers to internal admin endpoints as a Phase 7 foundation.

## 3. Admin route map

- `/admin`
- `/admin/login`
- `/admin/overview`
- `/admin/tenants`
- `/admin/tenants/[tenantId]`
- `/admin/subscriptions`
- `/admin/licenses`
- `/admin/devices`
- `/admin/payments`
- `/admin/invoices`
- `/admin/resellers`
- `/admin/resellers/[resellerId]`
- `/admin/support`
- `/admin/support/cases`
- `/admin/support/cases/[caseId]`
- `/admin/sync`
- `/admin/queues`
- `/admin/dead-letter`
- `/admin/integrations`
- `/admin/releases`
- `/admin/feature-flags`
- `/admin/coupons`
- `/admin/campaigns`
- `/admin/notices`
- `/admin/security`
- `/admin/audit`
- `/admin/settings`

## 4. Data model additions and changes

Phase 7 reuses existing operational/commercial tables for a first internal console pass:

- `tenants`
- `subscriptions`
- `invoices`
- `payment_transactions`
- `issued_licenses`
- `device_activations`
- `app_releases`
- `feature_flags`
- `plan_prices`
- `reseller_accounts`
- `reseller_customer_links`
- `reseller_commission_events`
- `payouts`
- `email_notifications`
- `audit_logs`

New explicit internal tables were intentionally deferred in this pass to avoid unverified schema drift; the admin service and endpoint contracts are now in place so the next step can persist support cases, internal notes, queue health snapshots, dead-letter records, and impersonation sessions explicitly.

## 5. Key admin workflows

- Tenant search and drill-down with subscription, license, device, notice, onboarding, and intervention context.
- Controlled tenant actions:
  - suspend
  - unsuspend
  - billing recheck request
  - feature flag refresh request
- Support case listing and case detail timeline from internal support intake foundations.
- Reseller overview and reseller detail.
- Dead-letter visibility.
- Release oversight.
- Feature flag, coupon, notice, and security overview surfaces.

## 6. Support and intervention safeguards

- Admin shell is separated from customer/reseller portals.
- Internal routes require an internal session in the web app.
- High-risk actions require a reason text on the UI.
- Backend intervention endpoints are role-aware.
- Intervention actions write audit entries instead of silently mutating business state.

## 7. Observability and queue strategy

- Overview dashboard exposes sync failure rate, dead-letter count, billing issue count, and release adoption summary.
- Dedicated `/admin/dead-letter` route surfaces failed event context.
- `/admin/sync`, `/admin/queues`, and `/admin/integrations` routes are scaffolded for deeper operational telemetry.
- Backend internal endpoints already expose dead-letter/release/tenant/reseller snapshots to support future deeper monitoring.

## 8. Security and audit strategy

- Internal web session is distinct from customer and reseller sessions.
- API requests for admin flows carry internal role metadata.
- Backend actions such as tenant suspend, unsuspend, billing recheck, and flag refresh write `audit_logs`.
- Security page exposes internal session and secret rotation summary foundations.

## 9. Edge-case handling strategy

- Tenant detail aggregates multiple commercial and operational signals so support does not need raw DB access for first diagnosis.
- Dead-letter view makes tenant-specific sync failures visible without blocking other tenants.
- Billing recheck and flag refresh are controlled actions, not silent edits.
- Admin drill-down pages keep reseller, tenant, and support context separated from customer-facing portals.

## 10. Implementation checklist

- [x] Internal admin shell and navigation
- [x] Internal admin login/session foundation
- [x] Overview dashboard
- [x] Tenant list and tenant detail
- [x] Reseller list and reseller detail
- [x] Support case list and case detail
- [x] Dead-letter visibility
- [x] Release / feature flag / coupon / notice / security surfaces
- [x] Header-based internal admin API foundation
- [x] Audited admin action endpoints for key tenant interventions

## 11. Scaffold code

- `apps/web-admin/components/admin/admin-shell.tsx`
- `apps/web-admin/components/admin/admin-login-form.tsx`
- `apps/web-admin/components/admin/admin-panels.tsx`
- `apps/web-admin/components/admin/admin-detail-panels.tsx`
- `apps/web-admin/lib/admin-service.ts`
- `apps/web-admin/app/admin/layout.tsx`
- `apps/web-admin/app/admin/[section]/page.tsx`
- `apps/api/src/LoomaPos.Api/Endpoints/InternalAdminEndpoints.cs`
- `apps/api/src/LoomaPos.Api/Program.cs`
