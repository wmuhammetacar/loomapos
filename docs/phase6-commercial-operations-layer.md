# Phase 6 Commercial Operations Layer

## 1. Architecture summary

Phase 6 completes the commercial administration layer of the platform. The web surfaces remain strictly commercial and administrative:

- Customer portal manages subscription, billing, company profile, licenses, devices, downloads, onboarding, users, security, and support intake.
- Reseller portal manages referrals, customers, commissions, payouts, assets, settings, and partner support intake.
- No cashier, inventory execution, shift control, refund processing, or store POS operations were added to the web layer.

## 2. Route map

Customer portal:

- `/portal`
- `/portal/subscription`
- `/portal/billing`
- `/portal/licenses`
- `/portal/devices`
- `/portal/downloads`
- `/portal/company`
- `/portal/users`
- `/portal/security`
- `/portal/support`
- `/portal/onboarding`

Reseller portal:

- `/reseller/portal`
- `/reseller/portal/customers`
- `/reseller/portal/referrals`
- `/reseller/portal/commissions`
- `/reseller/portal/payouts`
- `/reseller/portal/licenses`
- `/reseller/portal/assets`
- `/reseller/portal/support`
- `/reseller/portal/settings`

## 3. Data model additions and changes

No new Phase 6 tables were required; the implementation extends existing commercial entities:

- `portal_sessions`
- `tenant_users`
- `subscriptions`
- `billing_profiles`
- `invoices`
- `payment_transactions`
- `issued_licenses`
- `device_activations`
- `download_accesses`
- `email_notifications`
- `audit_logs`
- `reseller_accounts`
- `reseller_codes`
- `reseller_referrals`
- `reseller_customer_links`
- `reseller_commission_events`
- `payouts`

Phase 6 adds new endpoint logic on top of these tables for usage summaries, notices, onboarding, user access, security session control, support intake, reseller commission visibility, and payout visibility.

## 4. Customer portal feature map

- Overview cards for plan, renewal, license, and device usage.
- Subscription management with upgrade scheduling, immediate upgrade, cancel-at-period-end, and re-enable auto-renew.
- Billing visibility through invoices and payment history pages.
- License metadata view with key, plan, status, and expiry.
- Device management with rename and deactivate actions.
- Company profile management.
- Portal user invite, role update, and revoke access flow.
- Security page with password change, active sessions, and audit activity.
- Support intake form with request history.
- Onboarding checklist for company profile, license, downloads, devices, and team access.

## 5. Reseller portal feature map

- Overview totals for customers, conversions, commissions, and payouts.
- Customer list with commercial-only metadata.
- Referral performance and attribution history.
- Commission event listing.
- Payout history.
- License visibility summary by referred customer.
- Partner assets section.
- Support intake and support links.
- Settings snapshot for partner identity and commission configuration.

## 6. Subscription, license, and device business rules

- Plan changes are auditable.
- Upgrades can apply immediately.
- Downgrade-style changes are represented as scheduled changes and warnings are shown when current usage exceeds target limits.
- Cancellation is represented as cancel-at-period-end and the effective date remains visible.
- Reactivation clears cancel-at-period-end state and restores active renewal behavior when policy allows.
- Device actions are permission-protected.
- Device limits are visible through notices and usage summaries.
- License visibility remains metadata-only; no operational POS execution is exposed.

## 7. Trial, coupon, and promo foundations

- Subscription usage and trial status endpoints now expose:
  - `trialEndsAt`
  - `trialRemainingDays`
  - `promoAmount`
  - annual billing state
  - pending plan change metadata
- Coupon and campaign persistence remain provider-ready foundations from Phase 2/6 commercial modeling.

## 8. Security and audit strategy

- Portal access remains token-based through existing portal sessions.
- Customer portal actions are gated by portal roles.
- Reseller portal actions require reseller portal access.
- Critical changes now create audit trail records:
  - subscription cancel
  - subscription reactivation
  - plan change request
  - portal user invite
  - role change
  - access removal
  - password change
  - device rename
  - device deactivate
  - support request creation

## 9. Edge case handling

- Cancelled-but-still-active subscriptions show cancel-at-period-end state instead of hard stop.
- Device over-limit situations surface warnings instead of silently breaking understanding.
- Scheduled plan changes are represented separately from immediate upgrades.
- Owner access cannot be removed or role-changed from the portal.
- Device deactivation is explicit and auditable.
- Support requests are recorded even though support ticketing remains foundation-level.

## 10. Implementation checklist

- [x] Customer portal shell extended to Phase 6 sections
- [x] Reseller portal shell extended to Phase 6 sections
- [x] Customer overview, subscription, billing, license, device, download pages
- [x] Customer company, users, security, support, onboarding pages
- [x] Reseller overview, customers, referrals, commissions, payouts, licenses, assets, support, settings pages
- [x] Customer Phase 6 API contracts
- [x] Reseller Phase 6 API contracts
- [x] Subscription cancel/reactivate/change-plan behavior hardened
- [x] Audit logging for critical portal actions
- [x] Build verification for API and `web-admin`

## 11. Scaffold code

Primary implementation files:

- `apps/web-admin/components/portal/customer-portal-panels-phase6.tsx`
- `apps/web-admin/components/portal/reseller-portal-panels-phase6.tsx`
- `apps/web-admin/lib/portal-service.ts`
- `apps/api/src/LoomaPos.Api/Endpoints/CommerceCustomerPortalPhase6Endpoints.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommerceResellerPortalEndpoints.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommercePortalCoreEndpoints.cs`
