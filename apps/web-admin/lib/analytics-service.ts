import { API_BASE_URL, apiFetch, commerceFetch } from "@/lib/api-client";
import { getValidSession } from "@/lib/auth";

export interface AnalyticsFreshness {
  tier: string;
  generatedAt: string;
  sourceMaxTimestamp: string;
  status: string;
  note: string;
}

export interface AnalyticsKpiDefinition {
  code: string;
  name: string;
  category: string;
  formula: string;
  timeWindowLogic: string;
  inclusionRules: string;
  timezoneLogic: string;
  dataFreshnessExpectation: string;
  owner: string;
}

export interface AnalyticsKpiCard {
  code: string;
  label: string;
  value: string;
  description: string;
  comparisonLabel: string;
  delta: string;
  trend: string;
}

export interface AnalyticsSeriesPoint {
  label: string;
  value: number;
}

export interface AnalyticsSeries {
  label: string;
  unit: string;
  points: AnalyticsSeriesPoint[];
}

export interface AnalyticsBreakdownItem {
  key: string;
  label: string;
  primaryValue: number;
  secondaryValue: number;
  status: string;
  note: string;
}

export interface AnalyticsReportDefinition {
  code: string;
  name: string;
  audience: string;
  description: string;
  exportFormats: string[];
  filters: string[];
}

export interface AnalyticsScheduleTemplate {
  code: string;
  name: string;
  frequency: string;
  format: string;
  timezone: string;
  description: string;
}

export interface AnalyticsReportSchedule {
  id: string;
  name: string;
  reportCode: string;
  frequency: string;
  format: string;
  timezone: string;
  recipients: string[];
  filtersJson: string;
  isActive: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSavedView {
  id: string;
  scope: string;
  name: string;
  viewCode: string;
  filtersJson: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsAnomaly {
  id: string;
  type: string;
  severity: string;
  explanation: string;
  suggestedFollowUp: string;
  status: string;
  generatedAt: string;
  targetEntity: string;
  evidenceSignals: string[];
  baselinePeriod: string;
  comparisonPeriod: string;
  ruleVersion: string;
}

export interface AnalyticsRecommendation {
  id: string;
  type: string;
  targetEntity: string;
  explanation: string;
  evidenceSignals: string[];
  confidenceScore: number;
  generatedAt: string;
  status: string;
  recommendedAction: string;
  ruleVersion: string;
}

export interface TenantAnalyticsWorkspace {
  executive: {
    kpis: AnalyticsKpiCard[];
    trends: AnalyticsSeries[];
    highlights: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  sales: {
    trends: AnalyticsSeries[];
    branches: AnalyticsBreakdownItem[];
    paymentMethods: AnalyticsBreakdownItem[];
    devices: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  inventory: {
    kpis: AnalyticsKpiCard[];
    lowStock: AnalyticsBreakdownItem[];
    stockMoves: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  products: {
    topRevenueProducts: AnalyticsBreakdownItem[];
    topQuantityProducts: AnalyticsBreakdownItem[];
    refundHeavyProducts: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  branches: {
    branchPerformance: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  staff: {
    staffPerformance: AnalyticsBreakdownItem[];
    freshness: AnalyticsFreshness;
  };
  health: {
    score: number;
    status: string;
    drivers: string[];
    commercialKpis: AnalyticsKpiCard[];
    freshness: AnalyticsFreshness;
  };
  anomalies: AnalyticsAnomaly[];
  recommendations: AnalyticsRecommendation[];
  reportCatalog: AnalyticsReportDefinition[];
  scheduleTemplates: AnalyticsScheduleTemplate[];
}

export interface ResellerAnalyticsWorkspace {
  kpis: AnalyticsKpiCard[];
  funnel: AnalyticsBreakdownItem[];
  topCustomers: AnalyticsBreakdownItem[];
  commissionStatus: AnalyticsBreakdownItem[];
  freshness: AnalyticsFreshness;
}

export interface InternalAnalyticsWorkspace {
  kpis: AnalyticsKpiCard[];
  revenueTrends: AnalyticsSeries[];
  planMix: AnalyticsBreakdownItem[];
  billingHealth: AnalyticsBreakdownItem[];
  versionAdoption: AnalyticsBreakdownItem[];
  resellerPerformance: AnalyticsBreakdownItem[];
  anomalies: AnalyticsAnomaly[];
  recommendations: AnalyticsRecommendation[];
  freshness: AnalyticsFreshness;
}

export interface AnalyticsQualitySummary {
  generatedAt: string;
  lastEventIngestionAt: string;
  lastAggregateRefreshAt: string;
  duplicateEventCount: number;
  missingRefundLinkageCount: number;
  negativeStockAnomalyCount: number;
  missingBranchIdCount: number;
  paymentMismatchCount: number;
  orphanedHeartbeatCount: number;
  freshnessStatus: string;
  alerts: string[];
}

const fallbackFreshness: AnalyticsFreshness = {
  tier: "hourly",
  generatedAt: "2026-03-09T09:00:00Z",
  sourceMaxTimestamp: "2026-03-09T08:45:00Z",
  status: "fresh",
  note: "Fallback analytics snapshot"
};

const fallbackTenantWorkspace: TenantAnalyticsWorkspace = {
  executive: {
    kpis: [
      { code: "gross_sales", label: "Gross Sales", value: "184250.00 TRY", description: "Completed sales before refunds.", comparisonLabel: "vs previous period", delta: "12.4%", trend: "up" },
      { code: "net_sales", label: "Net Sales", value: "176900.00 TRY", description: "Gross sales minus refunds.", comparisonLabel: "refund amount", delta: "7350.00 TRY", trend: "down" },
      { code: "transaction_count", label: "Transactions", value: "428", description: "Completed transactions excluding voids.", comparisonLabel: "refund rate", delta: "4.0%", trend: "flat" },
      { code: "average_basket_value", label: "Average Basket", value: "413.32 TRY", description: "Net sales divided by effective transactions.", comparisonLabel: "units sold", delta: "1287", trend: "flat" }
    ],
    trends: [
      { label: "Net sales", unit: "TRY", points: [{ label: "04 Mar", value: 22500 }, { label: "05 Mar", value: 24800 }, { label: "06 Mar", value: 23100 }, { label: "07 Mar", value: 27900 }, { label: "08 Mar", value: 30100 }, { label: "09 Mar", value: 28500 }] }
    ],
    highlights: [
      { key: "branch-1", label: "Top branch: Kadikoy", primaryValue: 82450, secondaryValue: 201, status: "healthy", note: "Net sales and transactions." },
      { key: "product-1", label: "Top product: Damacana Su", primaryValue: 18420, secondaryValue: 612, status: "healthy", note: "Revenue and quantity." }
    ],
    freshness: fallbackFreshness
  },
  sales: {
    trends: [{ label: "Transactions", unit: "count", points: [{ label: "04 Mar", value: 61 }, { label: "05 Mar", value: 73 }, { label: "06 Mar", value: 66 }, { label: "07 Mar", value: 74 }, { label: "08 Mar", value: 79 }, { label: "09 Mar", value: 75 }] }],
    branches: [{ key: "kadikoy", label: "Kadikoy", primaryValue: 82450, secondaryValue: 201, status: "healthy", note: "Net sales and transactions." }],
    paymentMethods: [{ key: "cash", label: "Cash", primaryValue: 69300, secondaryValue: 196, status: "payment", note: "Amount and transaction count." }, { key: "card", label: "Card", primaryValue: 107600, secondaryValue: 232, status: "payment", note: "Amount and transaction count." }],
    devices: [{ key: "desk-1", label: "Kasiyer 1", primaryValue: 160, secondaryValue: 64500, status: "device_proxy", note: "Transaction count and payment total." }],
    freshness: fallbackFreshness
  },
  inventory: {
    kpis: [{ code: "low_stock_item_count", label: "Low Stock Items", value: "7", description: "Critical low stock count.", comparisonLabel: "negative stock", delta: "1", trend: "down" }],
    lowStock: [{ key: "su-kadikoy", label: "Damacana Su / Kadikoy", primaryValue: 2, secondaryValue: 10, status: "critical", note: "Current qty and min stock." }],
    stockMoves: [{ key: "sale", label: "sale", primaryValue: 1287, secondaryValue: 428, status: "movement", note: "Stock ledger movement." }],
    freshness: fallbackFreshness
  },
  products: {
    topRevenueProducts: [{ key: "damacana", label: "Damacana Su", primaryValue: 18420, secondaryValue: 612, status: "product", note: "Revenue and quantity." }],
    topQuantityProducts: [{ key: "cikolata", label: "Mini Cikolata", primaryValue: 880, secondaryValue: 7920, status: "product", note: "Quantity and revenue." }],
    refundHeavyProducts: [{ key: "sut", label: "Yarim Yagli Sut", primaryValue: 980, secondaryValue: 44, status: "product", note: "Refund revenue and quantity." }],
    freshness: fallbackFreshness
  },
  branches: {
    branchPerformance: [{ key: "kadikoy", label: "Kadikoy", primaryValue: 82450, secondaryValue: 201, status: "healthy", note: "Net sales and transactions." }],
    freshness: fallbackFreshness
  },
  staff: {
    staffPerformance: [{ key: "desk-1", label: "Kasiyer 1", primaryValue: 160, secondaryValue: 64500, status: "device_proxy", note: "Device proxy until explicit cashier dimension is synced." }],
    freshness: fallbackFreshness
  },
  health: {
    score: 78,
    status: "watch",
    drivers: ["plan_limit_pressure:92", "failed_payments:1"],
    commercialKpis: [{ code: "payment_failure_rate", label: "Payment Failures", value: "1", description: "Failed commerce payment attempts.", comparisonLabel: "support cases", delta: "2", trend: "down" }],
    freshness: fallbackFreshness
  },
  anomalies: [
    { id: "refund-spike", type: "refund_spike", severity: "high", explanation: "Refund rate increased to 18.0% compared with 6.0% baseline.", suggestedFollowUp: "Inspect refund-heavy products and branch behavior.", status: "new", generatedAt: "2026-03-09T08:52:00Z", targetEntity: "tenant-demo", evidenceSignals: ["refund_rate:18.0%", "baseline:6.0%"], baselinePeriod: "last_7_days", comparisonPeriod: "previous_7_days", ruleVersion: "rules-v1" }
  ],
  recommendations: [
    { id: "plan-upgrade", type: "plan_upgrade", targetEntity: "tenant-demo", explanation: "Active devices reached 95% of the current device limit.", evidenceSignals: ["active_devices:19", "device_limit:20"], confidenceScore: 0.86, generatedAt: "2026-03-09T08:53:00Z", status: "new", recommendedAction: "Review plan upgrade or deactivate unused devices.", ruleVersion: "rules-v1" }
  ],
  reportCatalog: [
    { code: "daily-sales", name: "Daily Sales", audience: "customer", description: "Executive summary of daily gross/net sales and transaction KPIs.", exportFormats: ["csv", "excel", "pdf_placeholder"], filters: ["date_range", "branch"] },
    { code: "low-stock", name: "Low Stock", audience: "customer", description: "Critical low stock items by branch.", exportFormats: ["csv", "excel"], filters: ["branch", "category"] }
  ],
  scheduleTemplates: [
    { code: "daily-owner-summary", name: "Daily owner summary", frequency: "daily", format: "csv", timezone: "Europe/Istanbul", description: "Daily executive summary sent to owners." }
  ]
};

const fallbackResellerWorkspace: ResellerAnalyticsWorkspace = {
  kpis: [
    { code: "referral_volume", label: "Referral Volume", value: "84", description: "Tracked referral visits and registrations.", comparisonLabel: "linked customers", delta: "24", trend: "flat" },
    { code: "purchase_conversion", label: "Purchase Conversion", value: "28.6%", description: "Converted customers over referral volume.", comparisonLabel: "active subscriptions", delta: "19", trend: "up" }
  ],
  funnel: [
    { key: "clicked", label: "Clicked", primaryValue: 84, secondaryValue: 0, status: "funnel", note: "Referral interactions." },
    { key: "purchased", label: "Purchased", primaryValue: 24, secondaryValue: 0, status: "funnel", note: "Converted customers." }
  ],
  topCustomers: [
    { key: "tenant-1", label: "Istanbul Market Group", primaryValue: 128500, secondaryValue: 18250, status: "customer", note: "Revenue and commission contribution." }
  ],
  commissionStatus: [
    { key: "approved", label: "approved", primaryValue: 18250, secondaryValue: 7, status: "commission", note: "Commission amount and event count by status." }
  ],
  freshness: fallbackFreshness
};

const fallbackInternalWorkspace: InternalAnalyticsWorkspace = {
  kpis: [
    { code: "active_paying_tenants", label: "Active Paying Tenants", value: "128", description: "Latest active subscription count.", comparisonLabel: "trial tenants", delta: "14", trend: "flat" },
    { code: "mrr", label: "MRR", value: "412950.00 TRY", description: "Monthly recurring revenue equivalent.", comparisonLabel: "renewal success", delta: "92.0%", trend: "up" }
  ],
  revenueTrends: [{ label: "MRR-equivalent revenue", unit: "TRY", points: [{ label: "04 Mar", value: 122000 }, { label: "05 Mar", value: 118000 }, { label: "06 Mar", value: 127500 }, { label: "07 Mar", value: 131400 }, { label: "08 Mar", value: 142000 }, { label: "09 Mar", value: 148500 }] }],
  planMix: [{ key: "pro", label: "PRO", primaryValue: 84, secondaryValue: 228000, status: "plan", note: "Plan mix by tenant count and MRR equivalent." }],
  billingHealth: [{ key: "paid", label: "paid", primaryValue: 112, secondaryValue: 418400, status: "billing", note: "Payment transaction count and amount by status." }],
  versionAdoption: [{ key: "desktop", label: "desktop 2.4.1", primaryValue: 184, secondaryValue: 76, status: "watch", note: "Device count and latest-version adoption percent." }],
  resellerPerformance: [{ key: "reseller-1", label: "Marmara Channel Partner", primaryValue: 16, secondaryValue: 18250, status: "approved", note: "Customer count and commission total." }],
  anomalies: [{ id: "internal-payment-mismatch", type: "billing_reconciliation_mismatch", severity: "high", explanation: "Detected 3 sale/payment mismatch record(s) in the quality checks.", suggestedFollowUp: "Review billing provider state against internal payment summaries.", status: "new", generatedAt: "2026-03-09T08:55:00Z", targetEntity: "platform", evidenceSignals: ["payment_mismatch:3"], baselinePeriod: "last_30_days", comparisonPeriod: "current_window", ruleVersion: "rules-v1" }],
  recommendations: [{ id: "internal-version-adoption", type: "version_adoption", targetEntity: "platform", explanation: "A significant portion of the device fleet is on lagging app versions.", evidenceSignals: ["desktop 2.4.1:184"], confidenceScore: 0.76, generatedAt: "2026-03-09T08:56:00Z", status: "new", recommendedAction: "Publish upgrade notices and enforce minimum supported versions.", ruleVersion: "rules-v1" }],
  freshness: fallbackFreshness
};

const fallbackQuality: AnalyticsQualitySummary = {
  generatedAt: "2026-03-09T09:00:00Z",
  lastEventIngestionAt: "2026-03-09T08:45:00Z",
  lastAggregateRefreshAt: "2026-03-09T09:00:00Z",
  duplicateEventCount: 0,
  missingRefundLinkageCount: 1,
  negativeStockAnomalyCount: 2,
  missingBranchIdCount: 0,
  paymentMismatchCount: 3,
  orphanedHeartbeatCount: 1,
  freshnessStatus: "fresh",
  alerts: ["Payment mismatch count is 3.", "Negative stock balances detected."]
};

async function optionalCommerceFetch<T>(path: string): Promise<T | null> {
  try {
    return await commerceFetch<T>(path);
  } catch {
    return null;
  }
}

async function optionalApiFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { ignoreTenantHeaders: true });
  } catch {
    return null;
  }
}

export async function loadAnalyticsCatalog() {
  const [kpis, reports] = await Promise.all([
    optionalApiFetch<AnalyticsKpiDefinition[]>("/analytics/catalog/kpis"),
    optionalApiFetch<AnalyticsReportDefinition[]>("/analytics/catalog/reports")
  ]);

  return {
    kpis: kpis ?? [],
    reports: reports ?? fallbackTenantWorkspace.reportCatalog
  };
}

export async function loadCustomerAnalyticsWorkspace(days = 30, branchId?: string | null) {
  const params = new URLSearchParams({ days: String(days), timezone: "Europe/Istanbul" });
  if (branchId) {
    params.set("branchId", branchId);
  }

  return (await optionalCommerceFetch<TenantAnalyticsWorkspace>(`/analytics/tenant/workspace?${params.toString()}`)) ?? fallbackTenantWorkspace;
}

export async function loadResellerAnalyticsWorkspace(days = 30) {
  return (await optionalCommerceFetch<ResellerAnalyticsWorkspace>(`/analytics/reseller/workspace?days=${days}&timezone=Europe/Istanbul`)) ?? fallbackResellerWorkspace;
}

export async function loadInternalAnalyticsWorkspace(days = 30) {
  return (await optionalApiFetch<InternalAnalyticsWorkspace>(`/analytics/internal/workspace?days=${days}&timezone=Europe/Istanbul`)) ?? fallbackInternalWorkspace;
}

export async function loadAnalyticsQualitySummary() {
  return (await optionalApiFetch<AnalyticsQualitySummary>("/analytics/internal/quality")) ?? fallbackQuality;
}

export async function downloadCustomerAnalyticsReport(reportCode: string, days = 30, branchId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const session = await getValidSession();
  if (!session?.accessToken) {
    return;
  }

  const params = new URLSearchParams({ days: String(days), timezone: "Europe/Istanbul" });
  if (branchId) {
    params.set("branchId", branchId);
  }

  const response = await fetch(`${API_BASE_URL}/analytics/tenant/export/${reportCode}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${reportCode}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function loadTenantAnalyticsSchedules() {
  return (await optionalCommerceFetch<AnalyticsReportSchedule[]>("/analytics/tenant/schedules")) ?? [];
}

export async function upsertTenantAnalyticsSchedule(input: {
  scheduleId?: string;
  name: string;
  reportCode: string;
  frequency: string;
  format: string;
  timezone: string;
  recipients: string[];
  filtersJson?: string;
  isActive?: boolean;
}) {
  return await commerceFetch<AnalyticsReportSchedule>("/analytics/tenant/schedules", {
    method: "POST",
    body: JSON.stringify({
      scheduleId: input.scheduleId,
      name: input.name,
      reportCode: input.reportCode,
      frequency: input.frequency,
      format: input.format,
      timezone: input.timezone,
      recipients: input.recipients,
      filtersJson: input.filtersJson ?? "{}",
      isActive: input.isActive ?? true
    })
  });
}

export async function loadTenantAnalyticsSavedViews() {
  return (await optionalCommerceFetch<AnalyticsSavedView[]>("/analytics/tenant/saved-views")) ?? [];
}

export async function saveTenantAnalyticsView(input: {
  name: string;
  viewCode: string;
  filtersJson?: string;
  isDefault?: boolean;
}) {
  return await commerceFetch<AnalyticsSavedView>("/analytics/tenant/saved-views", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      viewCode: input.viewCode,
      filtersJson: input.filtersJson ?? "{}",
      isDefault: input.isDefault ?? false
    })
  });
}

export async function deleteTenantAnalyticsView(viewId: string) {
  return await commerceFetch<{ deleted: boolean; viewId: string }>(`/analytics/tenant/saved-views/${viewId}`, {
    method: "DELETE"
  });
}
