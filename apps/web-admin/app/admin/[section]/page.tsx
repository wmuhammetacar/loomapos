import { notFound } from "next/navigation";
import { AdminPanels, type AdminSection } from "@/components/admin/admin-panels";
import { AdminAnalyticsPanel } from "@/components/analytics/analytics-panels";
import { AdminIntegrationPanel } from "@/components/integrations/integration-panels";
import { AdminOpsPanel, type OpsSection } from "@/components/admin/ops-panels";

const allowedSections = [
  "overview",
  "analytics",
  "tenants",
  "subscriptions",
  "licenses",
  "devices",
  "payments",
  "invoices",
  "resellers",
  "support",
  "sync",
  "queues",
  "dead-letter",
  "integrations",
  "deployments",
  "backups",
  "incidents",
  "runbooks",
  "slo",
  "releases",
  "feature-flags",
  "coupons",
  "campaigns",
  "notices",
  "security",
  "audit",
  "settings"
] as const;

interface AdminSectionPageProps {
  params: Promise<{ section: string }>;
}

export async function generateStaticParams() {
  return allowedSections.map((section) => ({ section }));
}

export default async function AdminSectionPage({ params }: AdminSectionPageProps) {
  const { section } = await params;

  if (!allowedSections.includes(section as (typeof allowedSections)[number])) {
    notFound();
  }

  if (section === "analytics") {
    return <AdminAnalyticsPanel />;
  }

  if (section === "integrations") {
    return <AdminIntegrationPanel />;
  }

  if (["deployments", "backups", "incidents", "runbooks", "slo"].includes(section)) {
    return <AdminOpsPanel section={section as OpsSection} />;
  }

  return <AdminPanels section={section as AdminSection} />;
}
