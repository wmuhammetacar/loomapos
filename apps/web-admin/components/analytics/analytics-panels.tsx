"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  deleteTenantAnalyticsView,
  downloadCustomerAnalyticsReport,
  loadAnalyticsCatalog,
  loadAnalyticsQualitySummary,
  loadCustomerAnalyticsWorkspace,
  loadInternalAnalyticsWorkspace,
  loadResellerAnalyticsWorkspace,
  loadTenantAnalyticsSavedViews,
  loadTenantAnalyticsSchedules,
  saveTenantAnalyticsView,
  upsertTenantAnalyticsSchedule,
  type AnalyticsAnomaly,
  type AnalyticsBreakdownItem,
  type AnalyticsKpiCard,
  type AnalyticsKpiDefinition,
  type AnalyticsReportSchedule,
  type AnalyticsRecommendation,
  type AnalyticsSavedView,
  type AnalyticsSeries,
  type AnalyticsQualitySummary,
  type InternalAnalyticsWorkspace,
  type ResellerAnalyticsWorkspace,
  type TenantAnalyticsWorkspace
} from "@/lib/analytics-service";

export function CustomerAnalyticsPanel() {
  const [workspace, setWorkspace] = useState<TenantAnalyticsWorkspace | null>(null);
  const [catalog, setCatalog] = useState<AnalyticsKpiDefinition[]>([]);
  const [schedules, setSchedules] = useState<AnalyticsReportSchedule[]>([]);
  const [savedViews, setSavedViews] = useState<AnalyticsSavedView[]>([]);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleReportCode, setScheduleReportCode] = useState("");
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewCode, setViewCode] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      loadCustomerAnalyticsWorkspace(),
      loadAnalyticsCatalog(),
      loadTenantAnalyticsSchedules(),
      loadTenantAnalyticsSavedViews()
    ])
      .then(([next, definitions, scheduleRows, savedViewRows]) => {
        setWorkspace(next);
        setCatalog(definitions.kpis);
        setSchedules(scheduleRows);
        setSavedViews(savedViewRows);
        if (!scheduleReportCode && next.reportCatalog.length > 0) {
          setScheduleReportCode(next.reportCatalog[0].code);
        }
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Analytics could not be loaded."));
  }, [scheduleReportCode]);

  if (!workspace) {
    return <LoadingCard title="Customer analytics" message={error ?? "Building KPI, trend and health summaries."} />;
  }

  const explanationMap = new Map(catalog.map((item) => [item.code, item]));

  return (
    <div className="space-y-6">
      <HeaderCard
        title="Retail analytics"
        subtitle="Analytics are derived from operational truth and remain read-only in the portal."
        freshness={workspace.executive.freshness}
      />
      <MetricGrid items={workspace.executive.kpis} explanationMap={explanationMap} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SeriesCard title="Executive trends" series={workspace.executive.trends} />
        <BreakdownCard title="Highlights" items={workspace.executive.highlights} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="Branch performance" items={workspace.branches.branchPerformance} />
        <BreakdownCard title="Payment mix" items={workspace.sales.paymentMethods} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="Top products by revenue" items={workspace.products.topRevenueProducts} />
        <BreakdownCard title="Low stock priorities" items={workspace.inventory.lowStock} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <HealthCard score={workspace.health.score} status={workspace.health.status} drivers={workspace.health.drivers} kpis={workspace.health.commercialKpis} />
        <RecommendationCard anomalies={workspace.anomalies} recommendations={workspace.recommendations} />
      </div>
      <Card>
        <CardTitle>Report catalog</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {workspace.reportCatalog.map((report) => (
            <div key={report.code} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{report.name}</p>
              <p className="mt-2 text-sm leading-6 text-text/72">{report.description}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.24em] text-text/55">
                Formats: {report.exportFormats.join(", ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" variant="outline" onClick={() => void downloadCustomerAnalyticsReport(report.code)}>
                  Export CSV
                </Button>
                <span className="rounded-full border border-line px-3 py-2 text-xs text-text/65">
                  Filters: {report.filters.join(", ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>Scheduled report foundations</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-[20px] border border-line bg-white/80 px-3 py-2 text-sm"
            value={scheduleName}
            onChange={(event) => setScheduleName(event.target.value)}
            placeholder="Schedule name"
          />
          <input
            className="rounded-[20px] border border-line bg-white/80 px-3 py-2 text-sm"
            value={scheduleReportCode}
            onChange={(event) => setScheduleReportCode(event.target.value)}
            placeholder="Report code"
          />
          <input
            className="rounded-[20px] border border-line bg-white/80 px-3 py-2 text-sm"
            value={scheduleRecipients}
            onChange={(event) => setScheduleRecipients(event.target.value)}
            placeholder="Recipients (comma separated)"
          />
          <Button
            variant="outline"
            disabled={!scheduleName || !scheduleReportCode}
            onClick={async () => {
              await upsertTenantAnalyticsSchedule({
                name: scheduleName,
                reportCode: scheduleReportCode,
                frequency: "weekly",
                format: "csv",
                timezone: "Europe/Istanbul",
                recipients: scheduleRecipients.split(",").map((x) => x.trim()).filter(Boolean)
              });
              setSchedules(await loadTenantAnalyticsSchedules());
              setScheduleName("");
              setActionMessage("Report schedule saved.");
            }}
          >
            Save schedule
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {workspace.scheduleTemplates.map((schedule) => (
            <div key={schedule.code} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{schedule.name}</p>
              <p className="mt-2 text-sm leading-6 text-text/72">{schedule.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <MetaPill label="Frequency" value={schedule.frequency} />
                <MetaPill label="Format" value={schedule.format} />
                <MetaPill label="Timezone" value={schedule.timezone} />
              </div>
            </div>
          ))}
          {schedules.map((schedule) => (
            <div key={schedule.id} className="rounded-[24px] border border-brand/20 bg-brand/5 px-4 py-4">
              <p className="font-semibold text-text">{schedule.name}</p>
              <p className="mt-2 text-sm leading-6 text-text/72">{schedule.reportCode} - {schedule.frequency} - {schedule.format}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <MetaPill label="Recipients" value={schedule.recipients.join(", ") || "-"} />
                <MetaPill label="Status" value={schedule.isActive ? "active" : "inactive"} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>Saved views</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-[20px] border border-line bg-white/80 px-3 py-2 text-sm"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="View name"
          />
          <input
            className="rounded-[20px] border border-line bg-white/80 px-3 py-2 text-sm"
            value={viewCode}
            onChange={(event) => setViewCode(event.target.value)}
            placeholder="View code (executive/sales...)"
          />
          <Button
            variant="outline"
            disabled={!viewName || !viewCode}
            onClick={async () => {
              await saveTenantAnalyticsView({ name: viewName, viewCode, isDefault: false, filtersJson: "{}" });
              setSavedViews(await loadTenantAnalyticsSavedViews());
              setViewName("");
              setActionMessage("Saved view created.");
            }}
          >
            Save view
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {savedViews.map((view) => (
            <div key={view.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{view.name}</p>
              <p className="mt-2 text-sm text-text/72">{view.viewCode} - {view.scope}</p>
              <div className="mt-4 flex gap-3">
                <MetaPill label="Default" value={view.isDefault ? "yes" : "no"} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await deleteTenantAnalyticsView(view.id);
                    setSavedViews(await loadTenantAnalyticsSavedViews());
                    setActionMessage("Saved view removed.");
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
        {actionMessage ? <p className="mt-4 text-sm text-brand">{actionMessage}</p> : null}
      </Card>
    </div>
  );
}

export function ResellerAnalyticsPanel() {
  const [workspace, setWorkspace] = useState<ResellerAnalyticsWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadResellerAnalyticsWorkspace()
      .then(setWorkspace)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Reseller analytics could not be loaded."));
  }, []);

  if (!workspace) {
    return <LoadingCard title="Reseller analytics" message={error ?? "Building referral, conversion and commission summaries."} />;
  }

  return (
    <div className="space-y-6">
      <HeaderCard title="Partner analytics" subtitle="Commercial referral and commission intelligence only; no customer store operations." freshness={workspace.freshness} />
      <MetricGrid items={workspace.kpis} />
      <div className="grid gap-6 xl:grid-cols-3">
        <BreakdownCard title="Funnel" items={workspace.funnel} />
        <BreakdownCard title="Top customers" items={workspace.topCustomers} />
        <BreakdownCard title="Commission status" items={workspace.commissionStatus} />
      </div>
    </div>
  );
}

export function AdminAnalyticsPanel() {
  const [workspace, setWorkspace] = useState<InternalAnalyticsWorkspace | null>(null);
  const [quality, setQuality] = useState<AnalyticsQualitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([loadInternalAnalyticsWorkspace(), loadAnalyticsQualitySummary()])
      .then(([next, qualitySummary]) => {
        setWorkspace(next);
        setQuality(qualitySummary);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Internal analytics could not be loaded."));
  }, []);

  if (!workspace || !quality) {
    return <LoadingCard title="Internal analytics" message={error ?? "Building SaaS revenue, quality and adoption views."} />;
  }

  return (
    <div className="space-y-6">
      <HeaderCard title="SaaS intelligence" subtitle="Platform-wide commercial and operational analytics for internal teams." freshness={workspace.freshness} />
      <MetricGrid items={workspace.kpis} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SeriesCard title="Revenue trend" series={workspace.revenueTrends} />
        <QualityCard quality={quality} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="Plan mix" items={workspace.planMix} />
        <BreakdownCard title="Billing health" items={workspace.billingHealth} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard title="Version adoption" items={workspace.versionAdoption} />
        <BreakdownCard title="Reseller performance" items={workspace.resellerPerformance} />
      </div>
      <RecommendationCard anomalies={workspace.anomalies} recommendations={workspace.recommendations} />
    </div>
  );
}

function HeaderCard({
  title,
  subtitle,
  freshness
}: {
  title: string;
  subtitle: string;
  freshness: { tier: string; generatedAt: string; sourceMaxTimestamp: string; status: string; note: string };
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/72">{subtitle}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <MetaPill label="Freshness" value={freshness.status} />
        <MetaPill label="Tier" value={freshness.tier} />
        <MetaPill label="Source max" value={formatDateTime(freshness.sourceMaxTimestamp)} />
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.24em] text-text/55">
        Generated {formatDateTime(freshness.generatedAt)} - {freshness.note}
      </p>
    </Card>
  );
}

function MetricGrid({
  items,
  explanationMap
}: {
  items: AnalyticsKpiCard[];
  explanationMap?: Map<string, AnalyticsKpiDefinition>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const explanation = explanationMap?.get(item.code);
        return (
          <Card key={item.code} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-text/60">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-text">{item.value}</p>
              </div>
              <StatusBadge value={item.trend} />
            </div>
            <p className="mt-3 text-sm leading-6 text-text/72">{item.description}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-text/55">
              {item.comparisonLabel}: {item.delta}
            </p>
            {explanation ? (
              <p className="mt-4 text-xs leading-5 text-text/55">
                Formula: {explanation.formula}
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

function SeriesCard({ title, series }: { title: string; series: AnalyticsSeries[] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-5 space-y-5">
        {series.map((item) => {
          const max = Math.max(...item.points.map((point) => point.value), 1);
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-text">{item.label}</p>
                <span className="text-xs uppercase tracking-[0.24em] text-text/55">{item.unit}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {item.points.map((point) => (
                  <div key={`${item.label}-${point.label}`} className="rounded-[20px] border border-line bg-muted/25 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-text/68">{point.label}</span>
                      <span className="text-sm font-semibold text-text">{formatNumber(point.value)}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-line/80">
                      <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(8, (point.value / max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BreakdownCard({ title, items }: { title: string; items: AnalyticsBreakdownItem[] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-text">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-text/72">{item.note}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetaPill label="Primary" value={formatNumber(item.primaryValue)} />
              <MetaPill label="Secondary" value={formatNumber(item.secondaryValue)} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HealthCard({
  score,
  status,
  drivers,
  kpis
}: {
  score: number;
  status: string;
  drivers: string[];
  kpis: AnalyticsKpiCard[];
}) {
  return (
    <Card>
      <CardTitle>Account health</CardTitle>
      <div className="mt-5 flex items-end justify-between gap-6">
        <div>
          <p className="text-5xl font-semibold text-text">{score}</p>
          <p className="mt-2 text-sm text-text/70">Status: {status}</p>
        </div>
        <StatusBadge value={status} />
      </div>
      <div className="mt-5 space-y-2">
        {drivers.map((driver) => (
          <div key={driver} className="rounded-full border border-line px-4 py-2 text-sm text-text/70">
            {driver}
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3">
        {kpis.map((item) => (
          <div key={item.code} className="rounded-[20px] border border-line bg-muted/25 px-4 py-4">
            <p className="text-sm text-text/60">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-text">{item.value}</p>
            <p className="mt-2 text-sm text-text/72">{item.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecommendationCard({
  anomalies,
  recommendations
}: {
  anomalies: AnalyticsAnomaly[];
  recommendations: AnalyticsRecommendation[];
}) {
  return (
    <Card>
      <CardTitle>Anomalies and recommendations</CardTitle>
      <div className="mt-5 space-y-4">
        {anomalies.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-danger/20 bg-danger/5 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-text">{item.type}</p>
              <StatusBadge value={item.severity} />
            </div>
            <p className="mt-2 text-sm leading-6 text-text/72">{item.explanation}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-text/55">
              {item.baselinePeriod} vs {item.comparisonPeriod}
            </p>
          </div>
        ))}
        {recommendations.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-brand/20 bg-brand/5 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-text">{item.type}</p>
              <span className="rounded-full border border-brand/20 px-3 py-2 text-xs uppercase tracking-[0.24em] text-brand">
                {(item.confidenceScore * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-text/72">{item.explanation}</p>
            <p className="mt-3 text-sm font-medium text-text">{item.recommendedAction}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function QualityCard({ quality }: { quality: AnalyticsQualitySummary }) {
  const counters = useMemo(
    () => [
      { label: "Duplicate events", value: String(quality.duplicateEventCount) },
      { label: "Refund linkage", value: String(quality.missingRefundLinkageCount) },
      { label: "Negative stock", value: String(quality.negativeStockAnomalyCount) },
      { label: "Payment mismatch", value: String(quality.paymentMismatchCount) }
    ],
    [quality]
  );

  return (
    <Card>
      <CardTitle>Data quality and freshness</CardTitle>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {counters.map((item) => (
          <MetaPill key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {quality.alerts.map((alert) => (
          <div key={alert} className="rounded-[20px] border border-line bg-muted/25 px-4 py-4 text-sm leading-6 text-text/72">
            {alert}
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.24em] text-text/55">
        Last ingestion {formatDateTime(quality.lastEventIngestionAt)} - refresh {formatDateTime(quality.lastAggregateRefreshAt)}
      </p>
    </Card>
  );
}

function LoadingCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/72">{message}</p>
    </Card>
  );
}

function StatusBadge({ value }: { value: string }) {
  const palette =
    value === "up" || value === "healthy" || value === "fresh"
      ? "border-success/30 bg-success/10 text-success"
      : value === "down" || value === "high" || value === "critical" || value === "stale"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-line bg-muted text-text/70";

  return (
    <span className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${palette}`}>
      {value}
    </span>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-line bg-muted/20 px-4 py-2 text-sm text-text/72">
      <span className="text-text/55">{label}: </span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2
  }).format(value);
}
