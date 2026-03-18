import { NextResponse } from "next/server";
import { getCrmLeadDetail, updateCrmLead } from "@/lib/crm-store";
import { crmLeadStatuses, type CrmLeadStatus } from "@/lib/crm-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ leadId: string }>;
}

interface LeadPatchPayload {
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

function isLeadStatus(value: string): value is CrmLeadStatus {
  return crmLeadStatuses.includes(value as CrmLeadStatus);
}

export async function GET(_: Request, { params }: RouteProps) {
  const { leadId } = await params;
  const detail = await getCrmLeadDetail(leadId);
  if (!detail) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { leadId } = await params;
  const body = (await request.json().catch(() => null)) as LeadPatchPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }

  const patch: LeadPatchPayload = {};
  if (body.status && isLeadStatus(body.status)) {
    patch.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    patch.assignedTo = body.assignedTo;
  }
  if (typeof body.scoreDelta === "number" && !Number.isNaN(body.scoreDelta)) {
    patch.scoreDelta = body.scoreDelta;
  }
  if (body.tenantId !== undefined) {
    patch.tenantId = body.tenantId;
  }
  if (body.resellerId !== undefined) {
    patch.resellerId = body.resellerId;
  }
  if (body.commissionEligible !== undefined) {
    patch.commissionEligible = body.commissionEligible;
  }
  if (body.conversionDate !== undefined) {
    patch.conversionDate = body.conversionDate;
  }
  if (body.lostReason !== undefined) {
    patch.lostReason = body.lostReason;
  }
  if (body.trialEndsAt !== undefined) {
    patch.trialEndsAt = body.trialEndsAt;
  }

  const lead = await updateCrmLead(leadId, patch, "system:sales_user");
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ lead });
}
