# LoomaPOS API Surface (Current)

Base URL (local):
- `http://127.0.0.1:5000`

Kanonik backend:
- `.NET API` (`apps/api/src/LoomaPos.Api`)

## Auth ve context
- Protected endpointler JWT/session context ile calisir.
- Tenant/branch/device baglami server tarafinda resolve edilir.
- Header degerleri (`X-Tenant-Id`, `X-Branch-Id`, `X-Device-Id`) varsa metadata/context amacli degerlendirilir; tek basina yetki kaynagi olarak kabul edilmemelidir.

## Health endpointleri
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /health/deep`

## Commerce auth endpointleri
- `POST /commerce/auth/register`
- `POST /commerce/auth/login`
- `POST /commerce/auth/desktop-login`
- `POST /commerce/auth/mobile-login`
- `POST /commerce/auth/reseller-login`
- `POST /commerce/auth/forgot-password`
- `POST /commerce/auth/reset-password`
- `POST /commerce/auth/verify-email`
- `POST /commerce/auth/refresh`
- `POST /commerce/auth/logout`
- `GET /commerce/auth/me`

Not:
- `mobile-login` ve `desktop-login` endpointleri `POST` bekler.
- Tarayicidan direkt `GET` ile acildiginda `405` donmesi beklenir.

## Commerce / license / portal
- `GET /commerce/plans`
- `POST /commerce/checkout`
- `POST /commerce/payments/webhooks`
- `POST /commerce/reseller/apply`
- `GET /commerce/reseller/{code}/dashboard`
- `POST /commerce/license/activate`
- `GET /commerce/license/status`
- `GET /commerce/portal/*`
- `GET /commerce/reseller-portal/*`

## POS core endpointleri
- `GET /sales`
- `GET /sales/{id}`
- `GET /products`
- `POST /products`
- `PATCH /products/{id}`
- `GET /products/{productId}/variants`
- `POST /products/{productId}/variants`
- `GET /stock`
- `POST /stock/adjustments`
- `GET /reports/daily-sales`
- `GET /reports/top-products`

## Sync
- `POST /sync/events`
- Idempotent isleme `processed_events` takibi ile korunur.

## Internal admin (control center)
- `GET /internal/admin/overview`
- `GET /internal/admin/tenants`
- `GET /internal/admin/tenants/{tenantId}`
- `GET /internal/admin/devices`
- `GET /internal/admin/sync-issues`
- `GET /internal/admin/support/cases`
- `GET /internal/admin/support/cases/{caseId}`
- `GET /internal/admin/auth/*` ve ilgili mutation endpointleri

## Public API v1 (partner)
- `GET /public/v1/meta`
- `GET /public/v1/docs/postman`
- `GET /public/v1/docs/sdk/typescript`
- `GET /public/v1/products`
- `GET /public/v1/analytics/summary`

## Referans
- `docs/partner-public-api-quickstart.md`
