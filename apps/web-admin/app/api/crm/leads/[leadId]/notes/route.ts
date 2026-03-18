import { NextResponse } from "next/server";
import { addCrmLeadNote } from "@/lib/crm-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ leadId: string }>;
}

interface NotePayload {
  note: string;
  createdBy?: string;
}

export async function POST(request: Request, { params }: RouteProps) {
  const { leadId } = await params;
  const body = (await request.json().catch(() => null)) as NotePayload | null;
  const note = body?.note?.trim();

  if (!note || note.length < 2) {
    return NextResponse.json({ error: "Note content is required." }, { status: 400 });
  }

  const saved = await addCrmLeadNote(leadId, note, body?.createdBy?.trim() || "system:sales_user");
  if (!saved) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  return NextResponse.json({ note: saved }, { status: 201 });
}
