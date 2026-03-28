import { NextResponse } from "next/server";
import { getResellerWorkspaceByLookup } from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resellerId = url.searchParams.get("resellerId") ?? undefined;
  const email = url.searchParams.get("email") ?? undefined;
  const referralCode = url.searchParams.get("referralCode") ?? undefined;

  const workspace = await getResellerWorkspaceByLookup({
    resellerId,
    email,
    referralCode
  });

  return NextResponse.json({ workspace });
}
