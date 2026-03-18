import { NextResponse } from "next/server";
import { trackCrmBehaviorEvent } from "@/lib/crm-store";
import { crmActivityTypes, crmLeadSources, type CrmActivityType, type CrmLeadSource } from "@/lib/crm-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BehaviorPayload {
  eventType:
    | CrmActivityType
    | "newsletter_signup"
    | "pricing_page_visit"
    | "download_attempt"
    | "signup_started"
    | "onboarding_completed";
  email?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  source?: CrmLeadSource;
  detail?: string;
  path?: string;
  actor?: string;
  tenantId?: string;
  resellerId?: string;
  commissionEligible?: boolean;
}

function isActivityType(value: string): value is CrmActivityType {
  return crmActivityTypes.includes(value as CrmActivityType);
}

function isLeadSource(value: string): value is CrmLeadSource {
  return crmLeadSources.includes(value as CrmLeadSource);
}

function isEventType(value: string) {
  return (
    isActivityType(value) ||
    value === "newsletter_signup" ||
    value === "pricing_page_visit" ||
    value === "download_attempt" ||
    value === "signup_started" ||
    value === "onboarding_completed"
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as BehaviorPayload | null;
  if (!body || !body.eventType || !isEventType(body.eventType)) {
    return NextResponse.json({ error: "Invalid CRM behavior payload." }, { status: 400 });
  }

  const result = await trackCrmBehaviorEvent({
    eventType: body.eventType,
    email: body.email?.trim().toLowerCase(),
    name: body.name?.trim(),
    companyName: body.companyName?.trim(),
    phone: body.phone?.trim(),
    source: body.source && isLeadSource(body.source) ? body.source : undefined,
    detail: body.detail?.trim(),
    path: body.path?.trim(),
    actor: body.actor?.trim(),
    tenantId: body.tenantId?.trim(),
    resellerId: body.resellerId?.trim(),
    commissionEligible: body.commissionEligible
  });

  return NextResponse.json(result, { status: 202 });
}
