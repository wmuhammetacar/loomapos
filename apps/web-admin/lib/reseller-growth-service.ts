"use client";

import type {
  ResellerApplicationInput,
  ResellerApplicationRecord,
  ResellerCommissionRecord,
  ResellerCommissionStatus,
  ResellerDetailWorkspace,
  ResellerGrowthDashboard,
  ResellerLeadAssignment,
  ResellerLeadAssignmentMode,
  ResellerPayoutRecord,
  ResellerPayoutStatus,
  ResellerProfile,
  ResellerStatus,
  ResellerTier
} from "@/lib/reseller-growth-types";

export interface ResellerProfileSummaryResponse {
  reseller: ResellerProfile;
  metrics: {
    leadsGenerated: number;
    conversionCount: number;
    conversionRate: number;
    revenue: number;
    churnRate: number;
    activeCustomers: number;
    pendingCommission: number;
    paidCommission: number;
  };
}

export interface AssignableCrmLeadSummaryResponse {
  leadId: string;
  name: string;
  email: string;
  companyName: string;
  status: string;
  score: number;
  source: string;
  createdAt: string;
  assignedResellerId?: string | null;
}

interface ReviewApplicationInput {
  decision: "approved" | "rejected";
  reviewer: string;
  note?: string;
  commissionRate?: number;
}

interface AssignLeadInput {
  leadId: string;
  resellerId: string;
  assignedBy: string;
  mode: ResellerLeadAssignmentMode;
  regionBasis?: string;
  performanceBasis?: string;
  overrideReason?: string;
}

interface TrackReferralInput {
  referralCode: string;
  eventType: "visit" | "signup" | "purchase";
  path?: string;
  source?: string;
  leadId?: string;
  customerId?: string;
  amount?: number;
  visitorEmail?: string;
}

interface CreateCommissionInput {
  resellerId: string;
  customerId: string;
  leadId?: string;
  amount?: number;
  triggerType: "new_subscription" | "renewal" | "upgrade";
}

interface UpdateResellerProfileInput {
  status?: ResellerStatus;
  region?: string;
  commissionRate?: number;
  tier?: ResellerTier;
}

async function resellerGrowthFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Reseller growth request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function submitResellerGrowthApplication(input: ResellerApplicationInput) {
  const payload = await resellerGrowthFetch<{ application: ResellerApplicationRecord }>(
    "/api/reseller-growth/applications",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );

  return payload.application;
}

export async function loadResellerGrowthApplications(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const payload = await resellerGrowthFetch<{ applications: ResellerApplicationRecord[] }>(
    `/api/reseller-growth/applications${query}`
  );

  return payload.applications;
}

export async function reviewResellerGrowthApplication(
  applicationId: string,
  input: ReviewApplicationInput
) {
  return await resellerGrowthFetch<{
    application: ResellerApplicationRecord;
    reseller: ResellerProfile | null;
  }>(`/api/reseller-growth/applications/${applicationId}/review`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadResellerGrowthDashboard() {
  const payload = await resellerGrowthFetch<{ dashboard: ResellerGrowthDashboard }>(
    "/api/reseller-growth/dashboard"
  );
  return payload.dashboard;
}

export async function loadResellerGrowthResellers(filters?: {
  status?: string;
  region?: string;
  query?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.region) {
    params.set("region", filters.region);
  }
  if (filters?.query) {
    params.set("query", filters.query);
  }

  const query = params.toString();
  const payload = await resellerGrowthFetch<{ resellers: ResellerProfileSummaryResponse[] }>(
    `/api/reseller-growth/resellers${query ? `?${query}` : ""}`
  );

  return payload.resellers;
}

export async function loadResellerGrowthResellerDetail(resellerId: string) {
  const payload = await resellerGrowthFetch<{ workspace: ResellerDetailWorkspace | null }>(
    `/api/reseller-growth/resellers/${resellerId}`
  );

  return payload.workspace;
}

export async function loadResellerGrowthWorkspaceByLookup(input: {
  resellerId?: string;
  email?: string;
  referralCode?: string;
}) {
  const params = new URLSearchParams();
  if (input.resellerId) {
    params.set("resellerId", input.resellerId);
  }
  if (input.email) {
    params.set("email", input.email);
  }
  if (input.referralCode) {
    params.set("referralCode", input.referralCode);
  }

  const payload = await resellerGrowthFetch<{ workspace: ResellerDetailWorkspace | null }>(
    `/api/reseller-growth/portal?${params.toString()}`
  );

  return payload.workspace;
}

export async function updateResellerGrowthProfile(
  resellerId: string,
  patch: UpdateResellerProfileInput
) {
  const payload = await resellerGrowthFetch<{ reseller: ResellerProfile }>(
    `/api/reseller-growth/resellers/${resellerId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch)
    }
  );

  return payload.reseller;
}

export async function loadAssignableResellerLeads(filters?: {
  status?: string;
  query?: string;
  minScore?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.query) {
    params.set("query", filters.query);
  }
  if (typeof filters?.minScore === "number") {
    params.set("minScore", String(filters.minScore));
  }

  const query = params.toString();
  const payload = await resellerGrowthFetch<{ leads: AssignableCrmLeadSummaryResponse[] }>(
    `/api/reseller-growth/leads${query ? `?${query}` : ""}`
  );

  return payload.leads;
}

export async function assignLeadToResellerGrowth(input: AssignLeadInput) {
  const payload = await resellerGrowthFetch<{ assignment: ResellerLeadAssignment }>(
    "/api/reseller-growth/leads/assign",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );

  return payload.assignment;
}

export async function trackResellerGrowthReferral(input: TrackReferralInput) {
  return await resellerGrowthFetch<{
    resellerId: string;
    referralCode: string;
    visits: number;
    signups: number;
    purchases: number;
  }>("/api/reseller-growth/referrals/track", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createResellerGrowthCommission(input: CreateCommissionInput) {
  const payload = await resellerGrowthFetch<{ commission: ResellerCommissionRecord }>(
    "/api/reseller-growth/commissions",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );

  return payload.commission;
}

export async function updateResellerGrowthCommissionStatus(
  commissionId: string,
  status: ResellerCommissionStatus
) {
  const payload = await resellerGrowthFetch<{ commission: ResellerCommissionRecord }>(
    `/api/reseller-growth/commissions/${commissionId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status })
    }
  );

  return payload.commission;
}

export async function createResellerGrowthPayout(input: {
  resellerId: string;
  commissionIds?: string[];
}) {
  const payload = await resellerGrowthFetch<{ payout: ResellerPayoutRecord }>(
    "/api/reseller-growth/payouts",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );

  return payload.payout;
}

export async function updateResellerGrowthPayoutStatus(
  payoutId: string,
  status: ResellerPayoutStatus
) {
  const payload = await resellerGrowthFetch<{ payout: ResellerPayoutRecord }>(
    `/api/reseller-growth/payouts/${payoutId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status })
    }
  );

  return payload.payout;
}
