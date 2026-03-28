import { NextResponse } from "next/server";
import { listAssignableCrmLeads } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const query = url.searchParams.get("query") ?? undefined;
  const minScoreRaw = url.searchParams.get("minScore");
  const minScore =
    minScoreRaw && !Number.isNaN(Number(minScoreRaw)) ? Number(minScoreRaw) : undefined;

  const leads = await listAssignableCrmLeads({
    status,
    query,
    minScore
  });

  return NextResponse.json({ leads });
}
