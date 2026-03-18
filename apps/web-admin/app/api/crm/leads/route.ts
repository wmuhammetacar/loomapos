import { NextResponse } from "next/server";
import { createOrUpdateCrmLead, listCrmLeads } from "@/lib/crm-store";
import {
  crmLeadSources,
  crmLeadStatuses,
  type CrmLeadFilters,
  type CrmLeadSource,
  type CrmLeadStatus
} from "@/lib/crm-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LeadPayload {
  name: string;
  email: string;
  phone?: string;
  companyName: string;
  source?: CrmLeadSource;
  status?: CrmLeadStatus;
  assignedTo?: string | null;
  tenantId?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  trialEndsAt?: string | null;
}

function isLeadSource(value: string): value is CrmLeadSource {
  return crmLeadSources.includes(value as CrmLeadSource);
}

function isLeadStatus(value: string): value is CrmLeadStatus {
  return crmLeadStatuses.includes(value as CrmLeadStatus);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters: CrmLeadFilters = {};

  const status = url.searchParams.get("status");
  if (status && isLeadStatus(status)) {
    filters.status = status;
  }

  const source = url.searchParams.get("source");
  if (source && isLeadSource(source)) {
    filters.source = source;
  }

  const assignedTo = url.searchParams.get("assignedTo");
  if (assignedTo) {
    filters.assignedTo = assignedTo;
  }

  const query = url.searchParams.get("query");
  if (query) {
    filters.query = query;
  }

  const minScore = url.searchParams.get("minScore");
  if (minScore && !Number.isNaN(Number(minScore))) {
    filters.minScore = Number(minScore);
  }

  const maxScore = url.searchParams.get("maxScore");
  if (maxScore && !Number.isNaN(Number(maxScore))) {
    filters.maxScore = Number(maxScore);
  }

  const dateFrom = url.searchParams.get("dateFrom");
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }

  const dateTo = url.searchParams.get("dateTo");
  if (dateTo) {
    filters.dateTo = dateTo;
  }

  const snapshot = await listCrmLeads(filters);
  return NextResponse.json(snapshot);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LeadPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid lead payload." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const companyName = body.companyName?.trim();

  if (!name || !email || !companyName) {
    return NextResponse.json(
      { error: "name, email and companyName are required." },
      { status: 400 }
    );
  }

  const source = body.source && isLeadSource(body.source) ? body.source : "contact_form";
  const status = body.status && isLeadStatus(body.status) ? body.status : undefined;

  const lead = await createOrUpdateCrmLead(
    {
      name,
      email,
      phone: body.phone?.trim(),
      companyName,
      source,
      status,
      assignedTo: body.assignedTo,
      tenantId: body.tenantId,
      resellerId: body.resellerId,
      commissionEligible: body.commissionEligible,
      trialEndsAt: body.trialEndsAt
    },
    "system:web_capture"
  );

  return NextResponse.json({ lead }, { status: 201 });
}
