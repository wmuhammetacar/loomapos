import { NextResponse } from "next/server";
import {
  listResellerApplications,
  submitResellerApplication
} from "@/lib/reseller-growth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApplicationPayload {
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  businessType: string;
  experience?: string;
  region: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;

  const applications = await listResellerApplications(
    status as
      | "submitted"
      | "under_review"
      | "approved"
      | "rejected"
      | undefined
  );

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ApplicationPayload | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
  }

  try {
    const application = await submitResellerApplication(body);
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Reseller application could not be created."
      },
      { status: 400 }
    );
  }
}
