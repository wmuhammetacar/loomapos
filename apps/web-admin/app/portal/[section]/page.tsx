import { notFound } from "next/navigation";
import { CustomerPortalPanelsPhase6 } from "@/components/portal/customer-portal-panels-phase6";
import { CustomerAnalyticsPanel } from "@/components/analytics/analytics-panels";
import { PortalIntegrationPanel } from "@/components/integrations/integration-panels";

const allowedSections = [
  "analytics",
  "integrations",
  "licenses",
  "subscription",
  "downloads",
  "billing",
  "devices",
  "company",
  "users",
  "security",
  "support",
  "onboarding"
] as const;

interface PortalSectionPageProps {
  params: Promise<{ section: string }>;
}

export async function generateStaticParams() {
  return allowedSections.map((section) => ({ section }));
}

export default async function PortalSectionPage({ params }: PortalSectionPageProps) {
  const { section } = await params;

  if (!allowedSections.includes(section as (typeof allowedSections)[number])) {
    notFound();
  }

  if (section === "analytics") {
    return <CustomerAnalyticsPanel />;
  }

  if (section === "integrations") {
    return <PortalIntegrationPanel />;
  }

  return <CustomerPortalPanelsPhase6 section={section as Exclude<(typeof allowedSections)[number], "analytics" | "integrations">} />;
}
