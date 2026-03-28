import { NextResponse } from "next/server";
import { trackResellerReferralEvent } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrackPayload {
  referralCode: string;
  eventType: "visit" | "signup" | "purchase";
  path?: string;
  source?: string;
  leadId?: string;
  customerId?: string;
  amount?: number;
  visitorEmail?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TrackPayload | null;
  if (!body || !body.referralCode || !body.eventType) {
    return NextResponse.json(
      { error: "referralCode and eventType are required." },
      { status: 400 }
    );
  }

  try {
    const stats = await trackResellerReferralEvent(body);
    return NextResponse.json(stats, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Referral track event failed."
      },
      { status: 400 }
    );
  }
}
