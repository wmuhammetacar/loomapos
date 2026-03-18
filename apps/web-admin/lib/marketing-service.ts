"use client";

export type MarketingLeadType = "contact" | "demo";
export type MarketingEventType = "page_view" | "cta_click" | "lead_submit";

export interface MarketingLeadInput {
  type: MarketingLeadType;
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  message: string;
  sourcePath: string;
}

interface MarketingLeadRecord extends MarketingLeadInput {
  id: string;
  createdAt: string;
}

interface MarketingEventInput {
  type: MarketingEventType;
  path?: string;
  label?: string;
  href?: string;
  context?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
}

interface MarketingEventRecord extends Required<Pick<MarketingEventInput, "type">> {
  id: string;
  path: string;
  label?: string;
  href?: string;
  context?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  createdAt: string;
}

interface MarketingStore {
  leads: MarketingLeadRecord[];
  events: MarketingEventRecord[];
}

const STORE_KEY = "loomapos_marketing_store";

function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

function emptyStore(): MarketingStore {
  return {
    leads: [],
    events: []
  };
}

function readStore(): MarketingStore {
  if (typeof window === "undefined") {
    return emptyStore();
  }

  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) {
    return emptyStore();
  }

  try {
    return JSON.parse(raw) as MarketingStore;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: MarketingStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function persistLead(lead: MarketingLeadRecord) {
  const store = readStore();
  writeStore({
    ...store,
    leads: [lead, ...store.leads.filter((item) => item.id !== lead.id)].slice(0, 200)
  });
}

function persistEvent(event: MarketingEventRecord) {
  const store = readStore();
  writeStore({
    ...store,
    events: [event, ...store.events.filter((item) => item.id !== event.id)].slice(0, 500)
  });
}

function pushToDataLayer(event: MarketingEventRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const globalWindow = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
  };

  globalWindow.dataLayer = globalWindow.dataLayer ?? [];
  globalWindow.dataLayer.push({
    event: `marketing_${event.type}`,
    path: event.path,
    label: event.label,
    href: event.href,
    context: event.context,
    source: event.source,
    medium: event.medium,
    campaign: event.campaign,
    referrer: event.referrer,
    createdAt: event.createdAt
  });
}

function dispatchEventToApi(event: MarketingEventRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify(event);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const payload = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/marketing/events", payload);
    return;
  }

  void fetch("/api/marketing/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => undefined);
}

function sanitizeLead(input: MarketingLeadInput): MarketingLeadInput {
  return {
    ...input,
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim(),
    message: input.message.trim(),
    sourcePath: input.sourcePath.trim()
  };
}

export function trackMarketingEvent(input: MarketingEventInput) {
  if (typeof window === "undefined") {
    return null;
  }

  const event: MarketingEventRecord = {
    id: makeId("evt"),
    type: input.type,
    path: input.path ?? window.location.pathname,
    label: input.label?.trim() || undefined,
    href: input.href?.trim() || undefined,
    context: input.context?.trim() || undefined,
    source: input.source?.trim() || undefined,
    medium: input.medium?.trim() || undefined,
    campaign: input.campaign?.trim() || undefined,
    referrer: input.referrer?.trim() || undefined,
    createdAt: new Date().toISOString()
  };

  persistEvent(event);
  pushToDataLayer(event);
  dispatchEventToApi(event);

  return event;
}

export async function submitMarketingLead(input: MarketingLeadInput) {
  const sanitized = sanitizeLead(input);

  try {
    const response = await fetch("/api/marketing/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sanitized)
    });

    if (!response.ok) {
      throw new Error("Lead endpoint returned a non-success response.");
    }

    const payload = (await response.json()) as {
      lead?: MarketingLeadRecord;
    };

    if (!payload.lead) {
      throw new Error("Lead endpoint did not return a saved lead.");
    }

    persistLead(payload.lead);
    trackMarketingEvent({
      type: "lead_submit",
      path: payload.lead.sourcePath,
      label: payload.lead.type,
      context: `${payload.lead.type}_form`,
      source: payload.lead.companyName
    });

    return payload.lead;
  } catch {
    const fallbackLead: MarketingLeadRecord = {
      ...sanitized,
      id: makeId("lead"),
      createdAt: new Date().toISOString()
    };

    persistLead(fallbackLead);
    trackMarketingEvent({
      type: "lead_submit",
      path: fallbackLead.sourcePath,
      label: fallbackLead.type,
      context: `${fallbackLead.type}_form`,
      source: fallbackLead.companyName
    });

    return fallbackLead;
  }
}

export function getMarketingSnapshot() {
  return readStore();
}
