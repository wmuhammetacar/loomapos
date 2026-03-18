import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketingEventType = "page_view" | "cta_click" | "lead_submit";

interface MarketingEventPayload {
  type: MarketingEventType;
  path: string;
  label?: string;
  href?: string;
  context?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

interface StoredMarketingEvent extends MarketingEventPayload {
  id: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".marketing-data");
const EVENTS_FILE = path.join(DATA_DIR, "marketing-events.json");

function isValidEvent(input: unknown): input is MarketingEventPayload {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<MarketingEventPayload>;
  return Boolean(
    (candidate.type === "page_view" ||
      candidate.type === "cta_click" ||
      candidate.type === "lead_submit") &&
      candidate.path?.trim()
  );
}

async function readEvents() {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    return JSON.parse(raw) as StoredMarketingEvent[];
  } catch {
    return [];
  }
}

async function writeEvents(events: StoredMarketingEvent[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf8");
}

export async function GET() {
  const events = await readEvents();
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidEvent(body)) {
    return NextResponse.json({ error: "Invalid marketing event payload." }, { status: 400 });
  }

  const event: StoredMarketingEvent = {
    ...body,
    path: body.path.trim(),
    label: body.label?.trim(),
    href: body.href?.trim(),
    context: body.context?.trim(),
    source: body.source?.trim(),
    medium: body.medium?.trim(),
    campaign: body.campaign?.trim(),
    referrer: body.referrer?.trim(),
    id: `evt_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString()
  };

  const events = await readEvents();
  await writeEvents([event, ...events].slice(0, 2000));

  return NextResponse.json({ event }, { status: 201 });
}
