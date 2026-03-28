import { NextResponse } from "next/server";
import { getResellerGrowthDashboard } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getResellerGrowthDashboard();
  return NextResponse.json({ dashboard });
}
