import { NextResponse } from "next/server";
import { reviewResellerApplication } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ applicationId: string }>;
}

interface ReviewPayload {
  decision: "approved" | "rejected";
  reviewer?: string;
  note?: string;
  commissionRate?: number;
}

export async function POST(request: Request, { params }: RouteProps) {
  const { applicationId } = await params;
  const body = (await request.json().catch(() => null)) as ReviewPayload | null;

  if (!body || !["approved", "rejected"].includes(body.decision)) {
    return NextResponse.json(
      { error: "decision must be approved or rejected." },
      { status: 400 }
    );
  }

  try {
    const payload = await reviewResellerApplication(applicationId, {
      decision: body.decision,
      reviewer: body.reviewer ?? "admin:channel_manager",
      note: body.note,
      commissionRate: body.commissionRate
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Application review action failed."
      },
      { status: 400 }
    );
  }
}
