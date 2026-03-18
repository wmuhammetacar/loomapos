import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import {
  alternativePages,
  docsPages,
  integrationHighlights,
  marketingBlogPosts,
  marketingFeatures,
  seoLandingPages,
  solutionPages,
  supportedMarketingLocales
} from "@/lib/marketing-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), ".marketing-data");
const CONTENT_FILE = path.join(DATA_DIR, "marketing-content-snapshot.json");

function getDefaultSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    locales: supportedMarketingLocales,
    landingPages: seoLandingPages,
    solutionPages,
    featurePages: marketingFeatures,
    alternativePages,
    integrationPages: integrationHighlights,
    docsPages,
    blogPosts: marketingBlogPosts
  };
}

export async function GET() {
  try {
    const raw = await fs.readFile(CONTENT_FILE, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(getDefaultSnapshot());
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid content payload." }, { status: 400 });
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    CONTENT_FILE,
    JSON.stringify({ ...body, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );

  return NextResponse.json({ ok: true });
}
