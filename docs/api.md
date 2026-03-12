# LoomaPOS API Surface (MVP)

Base URL:
- Local: `http://127.0.0.1:5000`

Auth:
- OIDC/JWT (Keycloak) for protected routes.
- Tenant context via claims/headers (`X-Tenant-Id`, `X-Branch-Id`, `X-Device-Id`).

## Public Commerce Endpoints
- `GET /commerce/plans`
  - Returns active plans (`starter/pro/enterprise`) and limits.
- `POST /commerce/checkout`
  - Creates tenant + branch + subscription + invoice + payment + issued license.
  - Input: company/email/plan/billingCycle/provider/resellerCode.
- `GET /commerce/portal/{tenantId}`
  - Subscription summary, invoices, device activations, license info.
- `POST /commerce/payments/webhooks`
  - Provider webhook ingest (idempotent by `provider+eventId`), updates subscription payment status.
- `POST /commerce/reseller/apply`
  - Creates reseller application and referral code.
- `GET /commerce/reseller/{code}/dashboard`
  - Reseller summary + commission rows.

## Licensing Endpoints (Protected)
- `POST /license/activate`
  - Activates current device, enforces max device limit, returns runtime mode.
- `GET /license/status`
  - Returns current license mode (`ACTIVE|READ_ONLY|LOCKED`) and usage.

## Core POS / Sync Endpoints
- `POST /sync/events`
- `GET /sales`
- `GET /sales/{id}`
- `GET /products`
- `POST /products`
- `GET /products/{productId}/variants`
- `POST /products/{productId}/variants`
- `GET /stock`
- `POST /stock/adjustments`
- `GET /reports/daily-sales`
- `GET /reports/top-products`

## Integrations (Mock in MVP)
- `POST /integrations/einvoice/mock/send`
- `POST /integrations/fiscal/mock/send`
- `GET /integrations/logs`

## Public API v1 (Partner)
- `GET /public/v1/meta`
  - Auth gerektirmez; scope listesi, endpoint listesi, OpenAPI/SDK/Postman artifact linklerini dondurur.
- `GET /public/v1/docs/postman`
  - Postman collection JSON.
- `GET /public/v1/docs/sdk/typescript`
  - TypeScript SDK snippet (foundation).
- `GET /public/v1/products`
  - Header: `X-Api-Key`
  - Scope: `products:read`
- `GET /public/v1/analytics/summary`
  - Header: `X-Api-Key`
  - Scope: `analytics:read`

Partner onboarding:
- `docs/partner-public-api-quickstart.md`
- `docs/partner-public-api.postman_collection.json`

## Identity / Admin
- `GET /tenants/me`
- `PUT /tenants/me/settings`
- `POST /tenants/me/logo`
- `GET /branches`
- `POST /branches`
- `PATCH /branches/{id}`
- `GET /users`
- `POST /users`
- `PATCH /users/{id}`
- `GET /roles`
- `POST /roles`
- `GET /license/me`
- `PUT /license/me`

## Key Data Tables (MVP)
- `tenants`, `branches`, `users`, `roles`, `user_roles`
- `products`, `categories`, `product_variants`, `product_barcodes`
- `stock_moves`, `stock_balances`
- `sales`, `sale_lines`, `payments`
- `subscriptions`, `plans`, `invoices`, `subscription_payments`, `payment_webhooks`
- `licenses`, `license_events`, `device_activations`
- `reseller_accounts`, `reseller_customers`, `commissions`, `payouts`
- `audit_logs`, `processed_events`
