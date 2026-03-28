import { NextResponse } from "next/server";
import {
  listResellerProfiles,
  type ResellerProfileListFilters
} from "@/lib/reseller-growth-store";
import { resellerStatuses } from "@/lib/reseller-growth-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isResellerStatus(value: string): value is (typeof resellerStatuses)[number] {
  return resellerStatuses.includes(value as (typeof resellerStatuses)[number]);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters: ResellerProfileListFilters = {};

  const status = url.searchParams.get("status");
  if (status && isResellerStatus(status)) {
    filters.status = status;
  }

  const region = url.searchParams.get("region");
  if (region) {
    filters.region = region;
  }

  const query = url.searchParams.get("query");
  if (query) {
    filters.query = query;
  }

  const resellers = await listResellerProfiles(filters);
  return NextResponse.json({ resellers });
}
