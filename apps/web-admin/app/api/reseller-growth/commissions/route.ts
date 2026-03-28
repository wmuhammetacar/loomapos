import { NextResponse } from "next/server";
import { createCommissionForReseller } from "@/lib/reseller-growth-store";
import { resellerCommissionTriggerTypes } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CommissionPayload {
  resellerId: string;
  customerId: string;
  leadId?: string;
  amount?: number;
  triggerType?: string;
}

function isTriggerType(value: string): value is (typeof resellerCommissionTriggerTypes)[number] {
  return resellerCommissionTriggerTypes.includes(
    value as (typeof resellerCommissionTriggerTypes)[number]
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CommissionPayload | null;
  if (!body || !body.resellerId || !body.customerId) {
    return NextResponse.json(
      { error: "resellerId and customerId are required." },
      { status: 400 }
    );
  }

  try {
    const commission = await createCommissionForReseller({
      resellerId: body.resellerId,
      customerId: body.customerId,
      leadId: body.leadId,
      amount: body.amount,
      triggerType:
        body.triggerType && isTriggerType(body.triggerType)
          ? body.triggerType
          : "new_subscription"
    });

    return NextResponse.json({ commission }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Commission could not be created."
      },
      { status: 400 }
    );
  }
}
