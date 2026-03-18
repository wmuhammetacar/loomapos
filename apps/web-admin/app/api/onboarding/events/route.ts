import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingEventType = "resume" | "step_completed" | "step_reopened";

interface OnboardingEventPayload {
  id?: string;
  type: OnboardingEventType;
  stepCode?: string;
  createdAt?: string;
  completionRate?: number;
  portal?: "customer" | "reseller";
  tenantId?: string | null;
}

interface StoredOnboardingEvent extends OnboardingEventPayload {
  id: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".onboarding-data");
const EVENTS_FILE = path.join(DATA_DIR, "onboarding-events.json");

function isValidEvent(input: unknown): input is OnboardingEventPayload {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<OnboardingEventPayload>;
  return Boolean(
    (candidate.type === "resume" ||
      candidate.type === "step_completed" ||
      candidate.type === "step_reopened")
  );
}

async function readEvents() {
  try {
    const raw = await fs.readFile(EVENTS_FILE, "utf8");
    return JSON.parse(raw) as StoredOnboardingEvent[];
  } catch {
    return [];
  }
}

async function writeEvents(events: StoredOnboardingEvent[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), "utf8");
}

function buildMetrics(events: StoredOnboardingEvent[]) {
  const stepCompleted = events.filter((event) => event.type === "step_completed");
  const resume = events.filter((event) => event.type === "resume").length;
  const byStep = stepCompleted.reduce<Record<string, number>>((acc, event) => {
    if (!event.stepCode) {
      return acc;
    }
    acc[event.stepCode] = (acc[event.stepCode] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalEvents: events.length,
    resumeEvents: resume,
    stepCompletionEvents: stepCompleted.length,
    byStep
  };
}

export async function GET() {
  const events = await readEvents();
  return NextResponse.json({
    events,
    metrics: buildMetrics(events)
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidEvent(body)) {
    return NextResponse.json({ error: "Invalid onboarding event payload." }, { status: 400 });
  }

  const event: StoredOnboardingEvent = {
    id: body.id?.trim() || `onb_${crypto.randomUUID().slice(0, 8)}`,
    type: body.type,
    stepCode: body.stepCode?.trim(),
    completionRate: typeof body.completionRate === "number" ? body.completionRate : undefined,
    portal: body.portal ?? "customer",
    tenantId: body.tenantId ?? null,
    createdAt: body.createdAt?.trim() || new Date().toISOString()
  };

  const events = await readEvents();
  await writeEvents([event, ...events].slice(0, 4000));

  return NextResponse.json({ event }, { status: 201 });
}
