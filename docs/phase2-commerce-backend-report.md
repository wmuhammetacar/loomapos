# Phase 2 Commerce Backend Report

Date: 2026-03-07

## 1) Architecture summary

Phase 2 adds the full commercial backend and authenticated account core behind the existing SaaS website.

Implemented scope:

- customer registration and login
- reseller login foundation
- checkout session creation
- payment provider abstraction
- verified webhook processing
- idempotent provisioning
- tenant and tenant-owner creation
- subscription activation and billing history
- license issuance with signed artifact
- download entitlement creation
- device activation preparation APIs
- customer portal data APIs
- company settings update flow
- forgot / reset password flow
- audit and email event persistence

Still enforced:

- no cashier UI
- no stock updates
- no branch operations
- no live POS workflow in the web layer

Key implementation areas:

- API startup and registrations:
  - `apps/api/src/LoomaPos.Api/Program.cs`
- commerce security, session, password, license signing:
  - `apps/api/src/LoomaPos.Api/Commerce/CommerceSecurityServices.cs`
- provisioning and checkout orchestration:
  - `apps/api/src/LoomaPos.Api/Commerce/CommerceProvisioningService.cs`
- seed data for plans, releases, demo reseller:
  - `apps/api/src/LoomaPos.Api/Commerce/CommerceSeedService.cs`
- portal/auth/checkout/license endpoints:
  - `apps/api/src/LoomaPos.Api/Endpoints/CommerceAuthCoreEndpoints.cs`
  - `apps/api/src/LoomaPos.Api/Endpoints/CommerceCheckoutCoreEndpoints.cs`
  - `apps/api/src/LoomaPos.Api/Endpoints/CommercePortalCoreEndpoints.cs`
  - `apps/api/src/LoomaPos.Api/Endpoints/CommerceLicenseCoreEndpoints.cs`
- domain and schema mappings:
  - `apps/api/src/LoomaPos.Infrastructure/Persistence/AppDbContext.cs`
  - `apps/api/src/LoomaPos.Infrastructure/Persistence/Configurations/CommerceCoreConfigurations.cs`
- frontend backend-first portal/auth/checkout integration:
  - `apps/web-admin/lib/commerce-service.ts`
  - `apps/web-admin/lib/auth.ts`

## 2) Lifecycle flow diagrams in text

### Purchase lifecycle

1. Visitor selects plan and billing period on `/checkout`.
2. `web-admin` posts to `POST /commerce/checkout/session`.
3. Backend validates plan, price, account identity and reseller code.
4. Backend creates a `checkout_session` and `payment_attempt`.
5. Selected payment adapter creates provider session.
6. Provider webhook or mock completion calls backend payment confirmation.
7. Backend provisions exactly once:
   - customer account
   - tenant
   - tenant owner link
   - billing profile
   - subscription
   - invoice and payment transaction
   - license record and signed token
   - download entitlements
   - audit logs
   - email notifications
8. Success page reads `GET /commerce/checkout/status/{id}`.
9. Portal session token is issued and stored in browser.
10. Customer enters `/portal` and sees subscription, license, downloads, billing and devices.

### Portal auth lifecycle

1. User registers or logs in through `/commerce/auth/register` or `/commerce/auth/login`.
2. Backend hashes passwords with PBKDF2.
3. Backend creates `portal_sessions` with opaque hashed access and refresh tokens.
4. Frontend stores the returned portal session metadata in `localStorage`.
5. Protected portal pages send `Authorization: Bearer <token>` to commerce APIs.

### License/device lifecycle

1. Successful provisioning generates `licenses` row and signed activation token.
2. Desktop or Mobile app calls:
   - `POST /commerce/license/validate`
   - `POST /commerce/license/activate`
   - `POST /commerce/license/heartbeat`
   - `POST /commerce/license/deactivate`
3. Backend enforces device limit from plan/license.
4. Activation events are persisted for future support and audit use.

## 3) Database schema

Phase 2 core schema now explicitly includes:

- `customer_accounts`
- `portal_sessions`
- `tenants`
- `tenant_users`
- `subscription_plans`
- `plan_prices`
- `feature_flags`
- `plan_feature_flags`
- `checkout_sessions`
- `billing_profiles`
- `subscriptions`
- `invoices`
- `invoice_lines`
- `payment_transactions`
- `payment_attempts`
- `payment_webhooks`
- `licenses`
- `license_events`
- `devices`
- `device_activations`
- `activation_events`
- `app_releases`
- `downloadable_assets`
- `download_accesses`
- `reseller_accounts`
- `reseller_codes`
- `reseller_referrals`
- `reseller_customer_links`
- `reseller_commission_events`
- `email_notifications`
- `audit_logs`

Production-oriented additions:

- created/updated timestamps
- unique indexes for codes, emails, invoice numbers and license keys
- provider metadata fields
- plan snapshot JSON on subscription creation
- password reset token fields
- idempotent webhook event storage

## 4) API list

### Auth

- `POST /commerce/auth/register`
- `POST /commerce/auth/login`
- `POST /commerce/auth/reseller-login`
- `POST /commerce/auth/forgot-password`
- `POST /commerce/auth/reset-password`
- `GET /commerce/auth/me`
- `POST /commerce/auth/logout`

### Checkout and billing

- `GET /commerce/pricing`
- `POST /commerce/checkout/session`
- `GET /commerce/checkout/status/{checkoutSessionId}`
- `POST /commerce/payments/webhooks`
- `POST /commerce/checkout/referral`
- `GET /commerce/reseller/referral/{code}`

### Portal

- `GET /commerce/portal/overview`
- `GET /commerce/portal/subscription`
- `POST /commerce/portal/subscription/cancel`
- `POST /commerce/portal/subscription/change-plan`
- `POST /commerce/portal/subscription/reactivate`
- `GET /commerce/portal/subscription/renewal`
- `GET /commerce/portal/licenses`
- `GET /commerce/portal/licenses/active`
- `GET /commerce/portal/licenses/{licenseId}`
- `POST /commerce/portal/licenses/{licenseId}/reissue`
- `GET /commerce/portal/downloads`
- `GET /commerce/portal/downloads/releases/{releaseId}/notes`
- `GET /commerce/portal/downloads/releases/{releaseId}/install-guide`
- `GET /commerce/portal/billing`
- `GET /commerce/portal/billing/{invoiceId}`
- `GET /commerce/portal/devices`
- `GET /commerce/portal/company`
- `PUT /commerce/portal/company`
- `GET /commerce/portal/support-links`

### License and device prep

- `POST /commerce/license/validate`
- `POST /commerce/license/activate`
- `POST /commerce/license/heartbeat`
- `POST /commerce/license/deactivate`

### Existing public reseller endpoints retained

- `POST /commerce/reseller/apply`
- `GET /commerce/reseller/{code}/dashboard`

## 5) Provisioning logic explanation

Provisioning is implemented server-side in `CommerceProvisioningService` and is explicitly separated from frontend checkout UI.

The backend flow:

1. Create checkout session.
2. Create payment attempt and provider session.
3. Verify webhook payload through provider adapter.
4. Store webhook event for idempotency.
5. Reload checkout session inside DB transaction.
6. Skip duplicate provisioning if `ProvisionedAt` already exists.
7. Create or reuse customer account.
8. Create or reuse tenant and tenant-owner relationship.
9. Create billing profile.
10. Create provider-backed subscription record.
11. Create invoice and payment transaction.
12. Generate signed license artifact.
13. Create license event and download access records.
14. Persist reseller links and commission-eligible records.
15. Queue email notifications.
16. Write audit logs and mark checkout as provisioned.

## 6) Security notes

Implemented:

- PBKDF2 password hashing
- opaque hashed portal tokens
- signed license token generation
- server-side-only provisioning
- rate limiting on auth and license endpoints
- webhook verification abstraction
- audit log persistence for checkout and license events
- protected portal route gating in web-admin
- no provider secrets exposed to frontend

Deferred production hardening:

- live provider webhook secret rollout
- refresh token rotation
- email verification
- outbound email provider integration
- stronger abuse protection per IP / per tenant

## 7) Route map

Public commercial routes added or updated in Phase 2:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/checkout`
- `/success`

Customer portal routes:

- `/portal`
- `/portal/subscription`
- `/portal/licenses`
- `/portal/downloads`
- `/portal/billing`
- `/portal/devices`
- `/portal/company`

Reseller routes:

- `/reseller/login`
- `/reseller/apply`
- `/reseller/portal`
- `/reseller/portal/customers`
- `/reseller/portal/commissions`
- `/reseller/portal/licenses`

## 8) Implementation checklist

Completed:

- formal plan and plan price model
- customer account and tenant-owner model
- backend checkout orchestration
- payment adapter abstraction with mock plus provider placeholders
- subscription activation records
- billing history entities
- signed license generation
- device activation APIs
- download entitlement registry
- transactional email event persistence
- reseller attribution schema and commission event pipeline
- customer portal auth and protection
- reseller login foundation
- company profile editing in portal
- frontend checkout success polling/fetch
- frontend portal data aggregation with backend-first strategy

Deferred:

- real provider keys and live recurring subscription operations
- payout workflows for reseller commissions
- invoice PDF generation
- mail transport provider wiring
- full browser coverage e2e suite beyond smoke navigation

## 9) Scaffold code

Frontend route and UI scaffold:

- `apps/web-admin/components/forms/checkout-form.tsx`
- `apps/web-admin/components/forms/customer-login-form.tsx`
- `apps/web-admin/components/forms/register-form.tsx`
- `apps/web-admin/components/forms/forgot-password-form.tsx`
- `apps/web-admin/components/forms/reset-password-form.tsx`
- `apps/web-admin/components/forms/success-panel.tsx`
- `apps/web-admin/components/portal/customer-portal-panels.tsx`

Backend scaffold:

- `apps/api/src/LoomaPos.Api/Commerce/CommerceProvisioningContracts.cs`
- `apps/api/src/LoomaPos.Api/Commerce/CommerceProvisioningService.cs`
- `apps/api/src/LoomaPos.Api/Commerce/CommerceSecurityServices.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommerceAuthCoreEndpoints.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommerceCheckoutCoreEndpoints.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommercePortalCoreEndpoints.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/CommerceLicenseCoreEndpoints.cs`

## Verification

- `dotnet build apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj`
- `npm run build` in `apps/web-admin`
- `cmd /c npm run test:e2e` in `apps/web-admin`

## Verdict

Phase 2 commercial backend and customer account core is now scaffolded and integrated with the website layer.

Accepted behaviors now exist for:

- customer register/login
- checkout session creation
- payment confirmation and idempotent provisioning
- tenant and subscription creation
- license delivery
- portal access
- billing history visibility
- download entitlement visibility
- device activation preparation

Operational POS behavior is still excluded from the website and portal layer.
