# Phase 8 Analytics Intelligence Layer

## 1. Architecture summary
- Transactional truth stays in Desktop, Mobile, and commerce backend stores.
- Phase 8 adds an explicit analytics read-model layer through `IAnalyticsReadModelService`.
- Retail, reseller, and internal SaaS analytics are exposed through dedicated `/analytics/...` endpoints.
- KPI definitions, report catalog, schedule templates, anomaly rules, recommendation rules, and freshness metadata are explicit contracts.
- Customer/reseller/admin web surfaces remain read-only analytics and account intelligence surfaces. No POS execution moved to web.

## 2. Analytics data flow
1. Desktop and Mobile produce operational truth: sale, refund, stock move, device heartbeat, subscription and billing events.
2. Backend persists operational truth in transactional tables.
3. Analytics read-model service ingests those facts into derived KPI, trend, anomaly, recommendation, and quality DTOs.
4. Portal analytics, reseller analytics, and internal admin analytics consume those DTOs instead of ad hoc raw-table views.
5. CSV export foundations and schedule templates are exposed for later background scheduling and email delivery.

## 3. Fact / dimension / aggregate model

### Dimensions
- `dim_tenant`
- `dim_branch`
- `dim_device`
- `dim_product`
- `dim_subscription_plan`
- `dim_reseller`
- `dim_license`
- `dim_app_version`

### Facts
- `fact_sales`
- `fact_sale_lines`
- `fact_refunds`
- `fact_payments`
- `fact_stock_moves`
- `fact_subscriptions`
- `fact_invoices`
- `fact_device_heartbeats`
- `fact_reseller_conversions`
- `fact_support_cases`

### Aggregates / read models
- `agg_daily_sales`
- `agg_branch_daily_sales`
- `agg_product_daily_sales`
- `agg_payment_method_daily`
- `agg_inventory_health`
- `agg_subscription_mrr`
- `agg_reseller_performance`
- `agg_customer_health`

Current repo implementation exposes these as typed read-model DTOs and service methods, ready for future persisted warehouse tables or materialized views.

## 4. KPI catalog

### Retail KPIs
- Gross Sales
- Net Sales
- Refund Amount
- Refund Rate
- Transaction Count
- Average Basket Value
- Units Sold
- Top Product by Revenue
- Top Product by Quantity
- Low Stock Item Count
- Stock Adjustment Count
- Cash vs Card Ratio
- Branch Growth Rate
- Staff Transaction Count
- Cash Discrepancy Count

### SaaS KPIs
- Active Paying Tenants
- Trial Tenants
- MRR
- Renewal Success Rate
- Payment Failure Rate
- Active Devices
- Average Devices per Tenant
- Support Case Open Count
- License Revocation Count
- Reseller Conversion Rate
- Coupon Redemption Rate
- Churn Risk Count

All KPI definitions now live in the analytics catalog endpoint with explicit formula, inclusion rules, timezone logic, and freshness expectation.

## 5. Report catalog

### Customer-facing
- Daily Sales
- Sales by Branch
- Sales by Product
- Sales by Payment Method
- Refund Report
- Stock Health
- Low Stock
- Stock Count Variance
- Staff Performance
- Device Version Health
- Account Health

### Internal
- Subscription Revenue
- MRR / Churn
- Billing Failure
- Device Fleet
- Sync Reliability
- Support SLA
- Reseller Performance
- Coupon / Campaign Performance
- Version Adoption
- Integration Health

## 6. Anomaly / recommendation strategy
- Rules-based anomaly detection is implemented first.
- Current anomaly foundations:
  - refund spike
  - sync failure cluster
  - negative stock incident
  - device activation burst
  - payment failure spike
- Recommendation foundations:
  - plan upgrade
  - restock fast sellers
  - review high-refund products
  - billing recovery
  - customer success outreach
- Every anomaly and recommendation includes explanation, evidence signals, rule version, baseline/comparison window, and suggested follow-up.

## 7. Customer health / churn strategy
- Health score uses explicit signals:
  - subscription state
  - failed payments
  - open support case count
  - heartbeat decline
  - plan limit pressure
  - onboarding completeness
  - active device presence
- Health statuses:
  - `healthy`
  - `watch`
  - `at_risk`
- Churn risk is surfaced both in tenant analytics and internal SaaS analytics.

## 8. Permission model for analytics
- Customer portal analytics:
  - allowed: `tenant_owner`, `company_admin`
  - blocked: billing-only and read-only portal roles
- Reseller analytics:
  - reseller portal only
  - commercial relationship data only
- Internal analytics:
  - requires internal admin headers/session context
- Analytics remain separate from Desktop/Mobile operational permissions.

## 9. Data quality / freshness strategy
- Quality surface exposes:
  - last event ingestion time
  - last aggregate refresh time
  - duplicate event count
  - missing refund linkage count
  - negative stock anomaly count
  - missing branch id count
  - payment mismatch count
  - orphaned heartbeat count
- Freshness is shown in every analytics workspace with tier, generated time, source max timestamp, and note.
- CSV export foundations are implemented for key customer reports.

## 10. Implementation checklist
- KPI catalog service and endpoint
- Report catalog and schedule template contracts
- Tenant analytics workspace
- Reseller analytics workspace
- Internal SaaS analytics workspace
- Internal quality/freshness summary
- Rules-based anomaly detection
- Explainable recommendation engine foundation
- Customer health scoring foundation
- Customer portal analytics page
- Reseller analytics page
- Internal admin analytics page
- CSV export foundation
- Analytics unit tests

## 11. Scaffold code
- Backend service: `apps/api/src/LoomaPos.Api/Analytics`
- Backend endpoints: `apps/api/src/LoomaPos.Api/Endpoints/AnalyticsEndpoints.cs`
- Pure calculation engine: `apps/api/src/LoomaPos.Application/Analytics/AnalyticsMetricEngine.cs`
- Customer/reseller/internal analytics UI: `apps/web-admin/components/analytics/analytics-panels.tsx`
- Frontend service: `apps/web-admin/lib/analytics-service.ts`
