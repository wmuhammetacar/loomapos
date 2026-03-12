# LoomaPOS Architecture

## 1. Product Boundaries
- Web (`apps/web-admin`): marketing + pricing + checkout + subscription portal + license delivery + download center.
- Desktop POS (`apps/desktop-pos`): operational sales workflow, offline-first local ledger/outbox, hardware integrations.
- Mobile (`apps/mobile`): stock counting, field operations, reports, offline sync.
- API (`apps/api`): modular monolith, multi-tenant, licensing, reseller, billing, sync, reporting.

Rule:
- Web **never** executes POS transactions (sales/stock operations).
- POS transactions run only on Desktop/Mobile.

## 2. High-Level Diagram
```text
                 +---------------------------+
                 |       Web Marketing       |
                 | pricing/checkout/portal   |
                 +------------+--------------+
                              |
                              v
 +----------------+   +-------+--------+   +---------------------+
 | Desktop POS    +---> ASP.NET Core   +<--+ Mobile App          |
 | offline SQLite |   | Modular API    |   | Drift SQLite        |
 | outbox events  |   | + Licensing    |   | outbox events       |
 +-------+--------+   +---+---------+--+   +----------+----------+
         |                |         |                |
         |                |         |                |
         v                v         v                v
  ESC/POS, scanner   PostgreSQL   Redis/RabbitMQ   S3/MinIO
  cash drawer         (tenant db)  jobs/events      files/backups
```

## 3. Backend Modules
- Identity & Tenant
- Catalog
- Inventory (ledger)
- Sales
- Customers
- Cashbook
- Reporting
- Sync
- Commerce/Billing/Licensing
- Reseller
- Payment Adapter Layer (mock in MVP, Stripe/iyzico/PayTR pluggable in v1.1+)
- Integrations (mock adapters for e-invoice/fiscal in MVP)

## 4. Multi-Tenant Model
- Shared PostgreSQL.
- Tenant-scoped tables include `tenant_id`.
- Request tenant context from OIDC claims/headers.
- Query filters enforce tenant isolation in EF.

## 5. Offline-First Sync
- Desktop/Mobile persist operations in local SQLite + `outbox_events`.
- Sync worker pushes events to `POST /sync/events`.
- Server idempotency via `processed_events(event_id)` unique key.
- Retries use exponential backoff.
- Stock is derived from movement ledger, never LWW overwrite.

## 6. Licensing and Device Limits
- Checkout issues subscription + invoice + signed license token.
- Device activation endpoint enforces `max_devices`.
- Runtime modes:
  - `ACTIVE`
  - `READ_ONLY` (within grace window)
  - `LOCKED` (expired + grace ended)

## 7. Reseller Flow
- Public reseller application.
- Referral code attached to checkout.
- Commission accrual created automatically per paid invoice.
- Dashboard exposes customer count + accrued/paid totals.

## 8. Observability
- OpenTelemetry traces/metrics/logs.
- Prometheus + Grafana + Loki + Tempo.
- Audit logs for critical actions (sales, stock, users, license activations, checkout events).

## 9. Deployment
- Monorepo + Turborepo.
- Local environment with Docker Compose (db, cache, queue, auth, storage, observability).
- CI:
  - API build/tests/image
  - Web build/lint/e2e
  - Desktop build + installer
