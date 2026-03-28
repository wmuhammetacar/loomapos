import { NextResponse } from "next/server";
import { createResellerPayout } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PayoutPayload {
  resellerId: string;
  commissionIds?: string[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PayoutPayload | null;
  if (!body?.resellerId) {
    return NextResponse.json({ error: "resellerId is required." }, { status: 400 });
  }

  try {
    const payout = await createResellerPayout(body);
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Payout could not be created."
      },
      { status: 400 }
    );
  }
}
