import { NextResponse } from "next/server";
import { assignLeadToReseller } from "@/lib/reseller-growth-store";
import { resellerLeadAssignmentModes } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AssignPayload {
  leadId: string;
  resellerId: string;
  assignedBy?: string;
  mode?: string;
  regionBasis?: string;
  performanceBasis?: string;
  overrideReason?: string;
}

function isAssignmentMode(value: string): value is (typeof resellerLeadAssignmentModes)[number] {
  return resellerLeadAssignmentModes.includes(
    value as (typeof resellerLeadAssignmentModes)[number]
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AssignPayload | null;
  if (!body || !body.leadId || !body.resellerId) {
    return NextResponse.json(
      { error: "leadId and resellerId are required." },
      { status: 400 }
    );
  }

  try {
    const assignment = await assignLeadToReseller({
      leadId: body.leadId,
      resellerId: body.resellerId,
      assignedBy: body.assignedBy ?? "admin:channel_manager",
      mode: body.mode && isAssignmentMode(body.mode) ? body.mode : "manual",
      regionBasis: body.regionBasis,
      performanceBasis: body.performanceBasis,
      overrideReason: body.overrideReason
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Lead assignment failed."
      },
      { status: 400 }
    );
  }
}
