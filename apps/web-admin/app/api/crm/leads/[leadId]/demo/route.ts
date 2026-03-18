import { NextResponse } from "next/server";
import { scheduleCrmDemo } from "@/lib/crm-store";
import { crmDemoStatuses, type CrmDemoStatus } from "@/lib/crm-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ leadId: string }>;
}

interface DemoPayload {
  date: string;
  time: string;
  assignedSalesRep: string;
  meetingLink?: string;
  status: CrmDemoStatus;
  createdBy?: string;
}

function isDemoStatus(value: string): value is CrmDemoStatus {
  return crmDemoStatuses.includes(value as CrmDemoStatus);
}

export async function POST(request: Request, { params }: RouteProps) {
  const { leadId } = await params;
  const body = (await request.json().catch(() => null)) as DemoPayload | null;

  if (!body || !body.date || !body.time || !body.assignedSalesRep || !isDemoStatus(body.status)) {
    return NextResponse.json({ error: "Invalid demo payload." }, { status: 400 });
  }

  const demo = await scheduleCrmDemo(
    leadId,
    {
      date: body.date,
      time: body.time,
      assignedSalesRep: body.assignedSalesRep,
      meetingLink: body.meetingLink,
      status: body.status,
      createdBy: body.createdBy
    },
    body.createdBy ?? "system:sales_user"
  );

  if (!demo) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ demo }, { status: 201 });
}
