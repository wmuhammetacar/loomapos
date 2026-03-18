import { NextResponse } from "next/server";
import { getCrmDashboard } from "@/lib/crm-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getCrmDashboard();
  return NextResponse.json(dashboard);
}
