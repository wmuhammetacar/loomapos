# Phase 5 Mobile Operational Core

## Architecture Summary

Phase 5 adds a real Flutter mobile companion for the POS ecosystem. Mobile remains branch-aware, role-aware, and offline-capable. Core operational writes are local-first via Drift-backed store abstractions, then pushed through an outbox/sync flow to the shared backend.

## Mobile Screen Map

- `Dashboard`
- `Urunler`
- `Stok Sayim`
- `Aktivite`
- `Ayarlar`
- modal: `ProductEditor`
- modal/page: `Scanner`
- detail: `StockCountDetail`

## Local Database Schema

Implemented local store surfaces cover:

- `app_settings`
- `local_session`
- `local_activation`
- `local_users`
- `local_permissions`
- `local_branches`
- `local_products`
- `local_product_barcodes`
- `local_stock_snapshot`
- `local_stock_count_sessions`
- `local_stock_count_lines`
- `local_recent_sales_cache`
- `outbox_events`
- `sync_state`
- `local_notifications`
- `local_audit_logs`
- `local_report_snapshots`

## Stock Count Lifecycle

1. User creates a count session for selected branch.
2. Session starts as `draft`.
3. Barcode scan or product search appends or merges count lines locally.
4. Session transitions to `in_progress`.
5. Submit marks session `submitted` and creates `STOCK_COUNT_SUBMITTED` outbox event.
6. Sync acknowledgement promotes session to `synced`.
7. Conflict/failure paths remain visible locally and retry-safe.

## Product Conflict Strategy

- Mobile product create/edit writes locally first.
- Outbox emits `PRODUCT_CREATED` or `PRODUCT_UPDATED`.
- Backend checks barcode uniqueness per tenant.
- Duplicate barcode returns `conflict`.
- Local product moves into reviewable conflict state instead of silent overwrite.

## Sync Model

Push:

- `STOCK_COUNT_SUBMITTED`
- `PRODUCT_CREATED`
- `PRODUCT_UPDATED`
- `MOBILE_SESSION_STARTED`
- `MOBILE_SESSION_ENDED`

Pull:

- products
- branch list
- permission snapshot
- feature flags
- dashboard summary
- recent activity
- notifications
- license snapshot

## Role And Branch Model

- cloud remains authority for actions and branch scope
- mobile caches permission snapshot locally
- owner/admin can operate across branches
- branch-scoped roles are limited to selected/assigned branch cache
- settings, product mutation, and stock count submission are gated by action codes

## Backend Contract Expectations

Implemented backend contract additions:

- `POST /commerce/auth/mobile-login`
- `GET /sync/pull`
  - returns `branches`, richer `products`, `dashboardSummary`, `recentActivity`, `notifications`
- `POST /sync/events/batch`
  - now accepts mobile product and stock-count events through shared sync processor

## Error Handling Strategy

- offline reopen depends on prior activation/session snapshot
- unknown barcode produces graceful not-found state
- stock count survives restart through local persistence
- sync conflicts stay visible as review items
- license and device warnings surface through sync payload notifications

## Implementation Checklist

- mobile shell scaffolded
- branch-aware dashboard added
- offline product lookup and barcode scan added
- stock count draft/resume/submit added
- product create/edit foundation added
- mobile sync event support added
- mobile pull summary payload added
- tests and analyzer updated

## Validation

- `puro flutter analyze` passed
- `puro flutter test` passed
- `dotnet build apps/api/src/LoomaPos.Api/LoomaPos.Api.csproj` passed

`puro flutter build apk --debug` could not be completed in this environment because `puro.exe` returned access denied.
