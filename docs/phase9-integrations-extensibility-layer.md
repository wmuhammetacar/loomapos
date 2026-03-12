# Phase 9 Integrations And Extensibility Layer

## 1) Architecture summary

Phase 9 adds a provider-agnostic integration platform on top of the existing commerce and operational layers. The core design is tenant-scoped, async-first and audit-heavy:

- `IntegrationConnection` is the tenant-level root for each provider/domain pair.
- Credentials, config and mappings are stored separately from business events.
- Jobs, attempts, failures and health snapshots model retryable async integration work.
- Outbound webhooks, inbound provider callbacks and public API keys/scopes use explicit idempotency and signing foundations.
- Portal and internal admin surfaces configure and inspect integrations, but they do not run POS cashier workflows.

Main backend centers:

- `apps/api/src/LoomaPos.Domain/Integrations/IntegrationEntities.cs`
- `apps/api/src/LoomaPos.Infrastructure/Persistence/IntegrationModelBuilderExtensions.cs`
- `apps/api/src/LoomaPos.Infrastructure/Integration/IIntegrationProviderAdapter.cs`
- `apps/api/src/LoomaPos.Infrastructure/Integration/MockIntegrationProviderAdapters.cs`
- `apps/api/src/LoomaPos.Api/Integrations/IntegrationSecurityServices.cs`
- `apps/api/src/LoomaPos.Api/Integrations/IntegrationPlatformService.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/Phase9IntegrationEndpoints.cs`

Main web surfaces:

- `/portal/integrations`
- `/admin/integrations`

## 2) Integration domain map

Supported Phase 9 domains under one adapter registry:

- `einvoice`
- `fiscal`
- `collections`
- `accounting`
- `ecommerce`
- `messaging`

Each domain is backed by `IIntegrationProviderAdapter`, which normalizes:

- credential validation
- provider account info fetch
- record submission
- status inquiry
- webhook receive handling
- health checks

## 3) Provider adapter contract design

`IIntegrationProviderAdapter` provides:

- `ValidateCredentialsAsync`
- `FetchAccountInfoAsync`
- `SubmitRecordAsync`
- `FetchStatusAsync`
- `ReceiveWebhookAsync`
- `HealthCheckAsync`

Phase 9 ships with mock adapters that prove the abstraction and keep vendor logic out of core business services:

- `MockEInvoiceAdapter`
- `MockFiscalAdapter`
- `MockCollectionAdapter`
- `MockAccountingAdapter`
- `MockEcommerceAdapter`
- `MockMessagingAdapter`

## 4) Data model additions/changes

New schema-ready entities include:

- `integration_connections`
- `integration_credentials`
- `integration_configs`
- `integration_mappings`
- `integration_jobs`
- `integration_job_attempts`
- `integration_events`
- `integration_logs`
- `integration_failures`
- `integration_health_snapshots`
- `integration_rate_limit_records`
- `provider_webhook_events`
- `outbound_webhook_endpoints`
- `outbound_webhook_subscriptions`
- `outbound_webhook_deliveries`
- `api_clients`
- `api_keys`
- `api_scopes`
- `api_usage_logs`
- `invoice_documents`
- `invoice_document_lines`
- `invoice_document_status_history`
- `invoice_provider_submissions`
- `invoice_artifacts`
- `invoice_mapping_errors`
- `fiscal_device_bindings`
- `fiscal_command_logs`
- `accounting_sync_records`
- `ecommerce_sync_records`
- `messaging_delivery_records`
- `integration_artifacts`
- `integration_audit_logs`

`AppDbContext` now binds these sets and applies table/index/query-filter configuration through `ConfigureIntegrationEntities(CurrentTenantId)`.

## 5) Webhook/public API strategy

Outbound webhooks:

- tenant-scoped endpoints
- subscribed topics
- protected secrets
- signed payload test foundation
- delivery log and retry-ready job records

Inbound webhooks:

- `/integrations/webhooks/inbound/{providerCode}`
- provider/event-key dedupe via `provider_webhook_events`
- adapter-based processing
- failure recording without corrupting core POS truth

Public API foundation:

- `/public/v1/products`
- `/public/v1/analytics/summary`
- `/public/v1/meta`
- `/public/v1/docs/postman`
- `/public/v1/docs/sdk/typescript`
- `X-Api-Key` auth
- per-client scopes
- usage logging
- rate-limit counter foundation

## 6) E-invoice/fiscal/payment/accounting/ecommerce rules

E-invoice:

- sale truth and document truth are decoupled
- duplicate submission is prevented with idempotency keys and provider submission records
- document status can lag sale completion safely

Fiscal:

- device bridge state is modeled separately from POS sale completion
- command logs are explicit
- cloud monitoring does not assume device reachability

Collections:

- online collection flow is async and callback-based
- provider delay cannot block cashier flows

Accounting/ERP:

- mapping is first-class, not hidden
- external references are stored for reconciliation

E-commerce:

- stock/order sync is channel-aware
- direction and mapping policy stay explicit
- duplicate order/product sync is handled through references and idempotency keys

## 7) Security and secret management strategy

Security foundations added:

- provider secrets protected with Data Protection via `IntegrationSecretService`
- API keys are one-time revealed and stored as hashes
- webhook secrets are rotated and masked
- public API access is scope-gated through `PublicApiAccessService`
- critical customer/admin changes are written to both `audit_logs` and `integration_audit_logs`

## 8) Mapping and idempotency strategy

Mapping:

- required mapping sets differ by domain
- missing mappings surface as warnings and configuration state
- mapping rows are explicit relational records

Idempotency:

- integration jobs and events store idempotency keys
- outbound deliveries store idempotency keys
- inbound provider callbacks dedupe on `(provider_code, event_key)`
- helper primitives live in `apps/api/src/LoomaPos.Application/Integrations/IntegrationPrimitives.cs`

## 9) Observability/failure handling strategy

Observability surfaces now track:

- connection health
- recent jobs
- failures
- dead-letter readiness
- provider callback history
- tenant-level unhealthy cohorts
- admin incident summary

Failure handling rules:

- provider outages degrade integration health, not POS transaction integrity
- duplicate callbacks are marked duplicate
- mapping or credential issues become visible review items
- manual retry is supported from internal admin tooling

## 10) Implementation checklist

- [x] Tenant-scoped integration domain and persistence model
- [x] Provider adapter abstraction and registry
- [x] Secret protection and API key foundations
- [x] Customer portal integration configuration surface
- [x] Internal admin integration diagnostics surface
- [x] Inbound webhook storage/dedupe foundation
- [x] Outbound webhook endpoint and test-send foundation
- [x] Public API scope/rate-limit foundation
- [x] Partner onboarding artifacts (quickstart + postman + sdk snippet endpoint)
- [x] E-invoice/fiscal/accounting/ecommerce/messaging domain modeling
- [x] Unit tests for signing/scope/mapping/retry primitives
- [x] Integration test for duplicate provider webhook event handling

## 11) Scaffold code

Primary files:

- `apps/api/src/LoomaPos.Domain/Integrations/IntegrationEntities.cs`
- `apps/api/src/LoomaPos.Infrastructure/Persistence/IntegrationModelBuilderExtensions.cs`
- `apps/api/src/LoomaPos.Infrastructure/Integration/IIntegrationProviderAdapter.cs`
- `apps/api/src/LoomaPos.Infrastructure/Integration/MockIntegrationProviderAdapters.cs`
- `apps/api/src/LoomaPos.Api/Integrations/IntegrationContracts.cs`
- `apps/api/src/LoomaPos.Api/Integrations/IntegrationSecurityServices.cs`
- `apps/api/src/LoomaPos.Api/Integrations/IntegrationPlatformService.cs`
- `apps/api/src/LoomaPos.Api/Endpoints/Phase9IntegrationEndpoints.cs`
- `apps/web-admin/lib/integration-service.ts`
- `apps/web-admin/components/integrations/integration-panels.tsx`
- `apps/web-admin/app/portal/[section]/page.tsx`
- `apps/web-admin/app/admin/[section]/page.tsx`
- `apps/web-admin/lib/site-content.ts`
- `apps/api/tests/LoomaPos.UnitTests/Integrations/IntegrationPrimitivesTests.cs`
- `apps/api/tests/LoomaPos.IntegrationTests/Integrations/ProviderWebhookIdempotencyTests.cs`
