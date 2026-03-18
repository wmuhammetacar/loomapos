import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarketingLeadPayload {
  type: "contact" | "demo";
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  message: string;
  sourcePath: string;
}

interface StoredMarketingLead extends MarketingLeadPayload {
  id: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".marketing-data");
const LEADS_FILE = path.join(DATA_DIR, "marketing-leads.json");

function isValidLead(input: unknown): input is MarketingLeadPayload {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<MarketingLeadPayload>;
  return Boolean(
    (candidate.type === "contact" || candidate.type === "demo") &&
      candidate.fullName?.trim() &&
      candidate.companyName?.trim() &&
      candidate.email?.trim() &&
      candidate.message?.trim() &&
      candidate.sourcePath?.trim()
  );
}

async function readLeads() {
  try {
    const raw = await fs.readFile(LEADS_FILE, "utf8");
    return JSON.parse(raw) as StoredMarketingLead[];
  } catch {
    return [];
  }
}

async function writeLeads(leads: StoredMarketingLead[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export async function GET() {
  const leads = await readLeads();
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidLead(body)) {
    return NextResponse.json({ error: "Invalid lead payload." }, { status: 400 });
  }

  const lead: StoredMarketingLead = {
    ...body,
    fullName: body.fullName.trim(),
    companyName: body.companyName.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone?.trim(),
    message: body.message.trim(),
    sourcePath: body.sourcePath.trim(),
    id: `lead_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString()
  };

  const leads = await readLeads();
  await writeLeads([lead, ...leads].slice(0, 1000));

  return NextResponse.json({ lead }, { status: 201 });
}
