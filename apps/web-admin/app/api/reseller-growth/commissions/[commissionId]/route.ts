import { NextResponse } from "next/server";
import { updateCommissionStatus } from "@/lib/reseller-growth-store";
import { resellerCommissionStatuses } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ commissionId: string }>;
}

interface PatchPayload {
  status?: string;
}

function isCommissionStatus(value: string): value is (typeof resellerCommissionStatuses)[number] {
  return resellerCommissionStatuses.includes(
    value as (typeof resellerCommissionStatuses)[number]
  );
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { commissionId } = await params;
  const body = (await request.json().catch(() => null)) as PatchPayload | null;

  if (!body?.status || !isCommissionStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be pending, approved or paid." },
      { status: 400 }
    );
  }

  try {
    const commission = await updateCommissionStatus(commissionId, body.status);
    return NextResponse.json({ commission });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Commission status update failed."
      },
      { status: 400 }
    );
  }
}
