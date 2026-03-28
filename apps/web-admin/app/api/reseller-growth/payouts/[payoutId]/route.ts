import { NextResponse } from "next/server";
import { updateResellerPayoutStatus } from "@/lib/reseller-growth-store";
import { resellerPayoutStatuses } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ payoutId: string }>;
}

interface PatchPayload {
  status?: string;
}

function isPayoutStatus(value: string): value is (typeof resellerPayoutStatuses)[number] {
  return resellerPayoutStatuses.includes(
    value as (typeof resellerPayoutStatuses)[number]
  );
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { payoutId } = await params;
  const body = (await request.json().catch(() => null)) as PatchPayload | null;

  if (!body?.status || !isPayoutStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be pending, processing, paid or failed." },
      { status: 400 }
    );
  }

  try {
    const payout = await updateResellerPayoutStatus(payoutId, body.status);
    return NextResponse.json({ payout });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Payout status update failed."
      },
      { status: 400 }
    );
  }
}
