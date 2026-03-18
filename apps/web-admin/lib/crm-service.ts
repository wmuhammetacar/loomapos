"use client";

import type {
  CrmActivityType,
  CrmDashboardResponse,
  CrmDemoStatus,
  CrmLead,
  CrmLeadDetailResponse,
  CrmLeadFilters,
  CrmLeadListResponse,
  CrmLeadSource,
  CrmLeadStatus
} from "@/lib/crm-types";

interface LeadCaptureInput {
  name: string;
  email: string;
  companyName: string;
  phone?: string;
  source: CrmLeadSource;
  status?: CrmLeadStatus;
  assignedTo?: string | null;
  tenantId?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  trialEndsAt?: string | null;
}

interface BehaviorEventInput {
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

interface LeadPatchInput {
  status?: CrmLeadStatus;
  assignedTo?: string | null;
  scoreDelta?: number;
  tenantId?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  conversionDate?: string | null;
  lostReason?: string | null;
  trialEndsAt?: string | null;
}

interface ActivityInput {
  type: CrmActivityType;
  title: string;
  detail?: string;
  createdBy?: string;
  metadata?: Record<string, string>;
}

interface DemoInput {
  date: string;
  time: string;
  assignedSalesRep: string;
  meetingLink?: string;
  status: CrmDemoStatus;
  createdBy?: string;
}

async function crmFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `CRM request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadCrmLeads(filters: CrmLeadFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.source) {
    params.set("source", filters.source);
  }
  if (filters.assignedTo) {
    params.set("assignedTo", filters.assignedTo);
  }
  if (typeof filters.minScore === "number") {
    params.set("minScore", String(filters.minScore));
  }
  if (typeof filters.maxScore === "number") {
    params.set("maxScore", String(filters.maxScore));
  }
  if (filters.query) {
    params.set("query", filters.query);
  }
  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  const query = params.toString();
  return await crmFetch<CrmLeadListResponse>(`/api/crm/leads${query ? `?${query}` : ""}`);
}

export async function loadCrmLeadDetail(leadId: string) {
  return await crmFetch<CrmLeadDetailResponse>(`/api/crm/leads/${leadId}`);
}

export async function loadCrmDashboard() {
  return await crmFetch<CrmDashboardResponse>("/api/crm/dashboard");
}

export async function captureCrmLead(input: LeadCaptureInput) {
  const payload = await crmFetch<{ lead: CrmLead }>("/api/crm/leads", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return payload.lead;
}

export async function trackCrmEvent(input: BehaviorEventInput) {
  return await crmFetch<{ lead: CrmLead | null; eventAccepted: boolean }>("/api/crm/events", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function patchCrmLead(leadId: string, patch: LeadPatchInput) {
  const payload = await crmFetch<{ lead: CrmLead }>(`/api/crm/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify(patch)
  });
  return payload.lead;
}

export async function addCrmLeadActivity(leadId: string, input: ActivityInput) {
  return await crmFetch<{ activity: unknown }>(`/api/crm/leads/${leadId}/activities`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function addCrmLeadNote(leadId: string, note: string, createdBy?: string) {
  return await crmFetch<{ note: unknown }>(`/api/crm/leads/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note, createdBy })
  });
}

export async function scheduleCrmLeadDemo(leadId: string, input: DemoInput) {
  return await crmFetch<{ demo: unknown }>(`/api/crm/leads/${leadId}/demo`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
