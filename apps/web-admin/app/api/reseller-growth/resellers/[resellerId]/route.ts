import { NextResponse } from "next/server";
import {
  getResellerDetailWorkspace,
  updateResellerProfile
} from "@/lib/reseller-growth-store";
import { resellerStatuses, resellerTiers } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ resellerId: string }>;
}

interface PatchPayload {
  status?: string;
  region?: string;
  commissionRate?: number;
  tier?: string;
}

function isResellerStatus(value: string): value is (typeof resellerStatuses)[number] {
  return resellerStatuses.includes(value as (typeof resellerStatuses)[number]);
}

function isResellerTier(value: string): value is (typeof resellerTiers)[number] {
  return resellerTiers.includes(value as (typeof resellerTiers)[number]);
}

export async function GET(_: Request, { params }: RouteProps) {
  const { resellerId } = await params;
  const workspace = await getResellerDetailWorkspace(resellerId);

  if (!workspace) {
    return NextResponse.json({ workspace: null }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const { resellerId } = await params;
  const body = (await request.json().catch(() => null)) as PatchPayload | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }

  try {
    const reseller = await updateResellerProfile(resellerId, {
      status: body.status && isResellerStatus(body.status) ? body.status : undefined,
      region: body.region,
      commissionRate:
        typeof body.commissionRate === "number" && Number.isFinite(body.commissionRate)
          ? body.commissionRate
          : undefined,
      tier: body.tier && isResellerTier(body.tier) ? body.tier : undefined
    });

    return NextResponse.json({ reseller });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Reseller profile update failed."
      },
      { status: 400 }
    );
  }
}
