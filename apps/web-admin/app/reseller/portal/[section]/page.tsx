import { notFound } from "next/navigation";
import { ResellerPortalPanelsPhase6 } from "@/components/portal/reseller-portal-panels-phase6";
import { ResellerAnalyticsPanel } from "@/components/analytics/analytics-panels";

const allowedSections = [
  "analytics",
  "customers",
  "referrals",
  "commissions",
  "payouts",
  "licenses",
  "assets",
  "support",
  "settings"
] as const;

interface ResellerPortalSectionPageProps {
  params: Promise<{ section: string }>;
}

export async function generateStaticParams() {
  return allowedSections.map((section) => ({ section }));
}

export default async function ResellerPortalSectionPage({
  params
}: ResellerPortalSectionPageProps) {
  const { section } = await params;

  if (!allowedSections.includes(section as (typeof allowedSections)[number])) {
    notFound();
  }

  if (section === "analytics") {
    return <ResellerAnalyticsPanel />;
  }

  return <ResellerPortalPanelsPhase6 section={section as Exclude<(typeof allowedSections)[number], "analytics">} />;
}
