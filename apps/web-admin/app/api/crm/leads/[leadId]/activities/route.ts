import { NextResponse } from "next/server";
import { addCrmLeadActivity } from "@/lib/crm-store";
import { crmActivityTypes, type CrmActivityType } from "@/lib/crm-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ leadId: string }>;
}

interface ActivityPayload {
  type: CrmActivityType;
  title: string;
  detail?: string;
  createdBy?: string;
  metadata?: Record<string, string>;
}

function isActivityType(value: string): value is CrmActivityType {
  return crmActivityTypes.includes(value as CrmActivityType);
}

export async function POST(request: Request, { params }: RouteProps) {
  const { leadId } = await params;
  const body = (await request.json().catch(() => null)) as ActivityPayload | null;

  if (!body || !body.type || !body.title || !isActivityType(body.type)) {
    return NextResponse.json({ error: "Invalid activity payload." }, { status: 400 });
  }

  const activity = await addCrmLeadActivity(
    leadId,
    {
      type: body.type,
      title: body.title.trim(),
      detail: body.detail?.trim(),
      createdBy: body.createdBy?.trim() || "system:sales_user",
      metadata: body.metadata
    },
    body.createdBy?.trim() || "system:sales_user"
  );

  if (!activity) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ activity }, { status: 201 });
}
