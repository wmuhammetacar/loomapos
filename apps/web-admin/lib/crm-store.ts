import { promises as fs } from "fs";
import path from "path";
import {
  crmLeadSources,
  crmLeadStatuses,
  crmScoreRules,
  type CrmActivityType,
  type CrmAuditLog,
  type CrmDashboardMetrics,
  type CrmDemoSchedule,
  type CrmEmailAutomationEvent,
  type CrmLead,
  type CrmLeadDetailResponse,
  type CrmLeadFilters,
  type CrmLeadListResponse,
  type CrmLeadSource,
  type CrmLeadStatus,
  type CrmNotification,
  type CrmSalesUser
} from "@/lib/crm-types";

interface CrmLeadActivity {
  activityId: string;
  leadId: string;
  type: CrmActivityType;
  title: string;
  detail?: string;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, string>;
}

interface CrmLeadNote {
  noteId: string;
  leadId: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

interface StoredMarketingLead {
  id: string;
  type: "contact" | "demo";
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  message: string;
  sourcePath: string;
  createdAt: string;
}

interface StoredMarketingEvent {
  id: string;
  type: "page_view" | "cta_click" | "lead_submit";
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

interface StoredOnboardingEvent {
  id: string;
  type: "resume" | "step_completed" | "step_reopened";
  stepCode?: string;
  portal?: "customer" | "reseller";
  tenantId?: string | null;
  completionRate?: number;
  createdAt: string;
}

interface CrmStore {
  leads: CrmLead[];
  activities: CrmLeadActivity[];
  notes: CrmLeadNote[];
  demos: CrmDemoSchedule[];
  salesUsers: CrmSalesUser[];
  notifications: CrmNotification[];
  emailAutomations: CrmEmailAutomationEvent[];
  auditLogs: CrmAuditLog[];
  importState: {
    marketingLeadIds: string[];
    marketingEventIds: string[];
    onboardingEventIds: string[];
  };
  updatedAt: string;
}

interface LeadCaptureInput {
  name: string;
  email: string;
  companyName: string;
  phone?: string;
  source: CrmLeadSource;
  assignedTo?: string | null;
  status?: CrmLeadStatus;
  tenantId?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  trialEndsAt?: string | null;
}

interface LeadPatchInput {
  status?: CrmLeadStatus;
  assignedTo?: string | null;
  scoreDelta?: number;
  tenantId?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  conversionDate?: string | null;
  lostReason?: string | null;
  trialEndsAt?: string | null;
}

interface ActivityInput {
  type: CrmActivityType;
  title: string;
  detail?: string;
  createdBy?: string;
  createdAt?: string;
  metadata?: Record<string, string>;
  importKey?: string;
}

interface DemoInput {
  date: string;
  time: string;
  assignedSalesRep: string;
  meetingLink?: string;
  status: "scheduled" | "completed" | "no_show";
  createdBy?: string;
}

interface BehaviorEventInput {
  eventType:
    | CrmActivityType
    | "newsletter_signup"
    | "pricing_page_visit"
    | "download_attempt"
    | "signup_started"
    | "onboarding_completed";
  email?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  source?: CrmLeadSource;
  detail?: string;
  path?: string;
  actor?: string;
  tenantId?: string;
  resellerId?: string;
  commissionEligible?: boolean;
}

const DATA_DIR = path.join(process.cwd(), ".crm-data");
const STORE_FILE = path.join(DATA_DIR, "crm-store.json");

const MARKETING_DATA_DIR = path.join(process.cwd(), ".marketing-data");
const MARKETING_LEADS_FILE = path.join(MARKETING_DATA_DIR, "marketing-leads.json");
const MARKETING_EVENTS_FILE = path.join(MARKETING_DATA_DIR, "marketing-events.json");

const ONBOARDING_DATA_DIR = path.join(process.cwd(), ".onboarding-data");
const ONBOARDING_EVENTS_FILE = path.join(ONBOARDING_DATA_DIR, "onboarding-events.json");

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: string | undefined | null) {
  return (value ?? "").trim();
}

function normalizeEmail(value: string | undefined | null) {
  return normalizeText(value).toLowerCase();
}

function normalizeCompany(value: string | undefined | null) {
  return normalizeText(value).toLowerCase();
}

function asTimestamp(value: string | undefined | null) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function emptyPipelineDistribution(): Record<CrmLeadStatus, number> {
  return {
    new: 0,
    contacted: 0,
    qualified: 0,
    demo_scheduled: 0,
    proposal_sent: 0,
    converted: 0,
    lost: 0
  };
}

function isCrmLeadStatus(value: string): value is CrmLeadStatus {
  return crmLeadStatuses.includes(value as CrmLeadStatus);
}

function isCrmLeadSource(value: string): value is CrmLeadSource {
  return crmLeadSources.includes(value as CrmLeadSource);
}

const defaultSalesUsers: CrmSalesUser[] = [
  {
    userId: "sales-1",
    name: "Aylin Demir",
    email: "aylin.demir@loomapos.local",
    role: "sales_manager",
    active: true,
    createdAt: "2026-02-10T08:00:00Z"
  },
  {
    userId: "sales-2",
    name: "Mert Kaya",
    email: "mert.kaya@loomapos.local",
    role: "sales_rep",
    active: true,
    createdAt: "2026-02-10T08:00:00Z"
  },
  {
    userId: "sales-3",
    name: "Ece Arslan",
    email: "ece.arslan@loomapos.local",
    role: "sales_rep",
    active: true,
    createdAt: "2026-02-10T08:00:00Z"
  }
];

const fallbackStore: CrmStore = {
  leads: [
    {
      leadId: "lead_demo_001",
      name: "Burak Yildiz",
      email: "burak@bosphorusretail.test",
      phone: "+90 532 200 10 10",
      companyName: "Bosphorus Retail",
      source: "demo_request",
      status: "demo_scheduled",
      score: 70,
      assignedTo: "sales-2",
      createdAt: "2026-03-12T08:15:00Z",
      updatedAt: "2026-03-14T12:00:00Z",
      lastActivityAt: "2026-03-14T12:00:00Z"
    },
    {
      leadId: "lead_demo_002",
      name: "Selin Acar",
      email: "selin@ankaramarket.test",
      phone: "+90 532 200 10 11",
      companyName: "Ankara Market Plus",
      source: "pricing_cta",
      status: "qualified",
      score: 45,
      assignedTo: "sales-3",
      createdAt: "2026-03-11T10:30:00Z",
      updatedAt: "2026-03-13T09:00:00Z",
      lastActivityAt: "2026-03-13T09:00:00Z"
    },
    {
      leadId: "lead_demo_003",
      name: "Can Erdem",
      email: "can@egecafe.test",
      phone: "+90 532 200 10 12",
      companyName: "Ege Cafe Group",
      source: "checkout_start",
      status: "contacted",
      score: 30,
      assignedTo: "sales-1",
      createdAt: "2026-03-10T09:15:00Z",
      updatedAt: "2026-03-10T18:00:00Z",
      lastActivityAt: "2026-03-10T18:00:00Z"
    }
  ],
  activities: [
    {
      activityId: "act_demo_001",
      leadId: "lead_demo_001",
      type: "demo_requested",
      title: "Demo request captured",
      detail: "Lead requested a guided demo from /demo.",
      createdAt: "2026-03-12T08:16:00Z",
      createdBy: "system"
    },
    {
      activityId: "act_demo_002",
      leadId: "lead_demo_003",
      type: "signup_started",
      title: "Checkout started",
      detail: "Lead started pricing checkout flow.",
      createdAt: "2026-03-10T18:00:00Z",
      createdBy: "system"
    }
  ],
  notes: [
    {
      noteId: "note_demo_001",
      leadId: "lead_demo_001",
      note: "Interested in multi-branch rollout before June.",
      createdAt: "2026-03-13T09:45:00Z",
      createdBy: "sales-2"
    }
  ],
  demos: [
    {
      demoId: "demo_001",
      leadId: "lead_demo_001",
      date: "2026-03-19",
      time: "14:00",
      assignedSalesRep: "sales-2",
      meetingLink: "https://meet.example.com/demo-001",
      status: "scheduled",
      createdAt: "2026-03-13T10:00:00Z",
      updatedAt: "2026-03-13T10:00:00Z"
    }
  ],
  salesUsers: defaultSalesUsers,
  notifications: [],
  emailAutomations: [],
  auditLogs: [],
  importState: {
    marketingLeadIds: [],
    marketingEventIds: [],
    onboardingEventIds: []
  },
  updatedAt: nowIso()
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeStore(store: CrmStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sanitizeStore(input: CrmStore): CrmStore {
  const store: CrmStore = {
    ...input,
    leads: Array.isArray(input.leads) ? input.leads : [],
    activities: Array.isArray(input.activities) ? input.activities : [],
    notes: Array.isArray(input.notes) ? input.notes : [],
    demos: Array.isArray(input.demos) ? input.demos : [],
    salesUsers: Array.isArray(input.salesUsers) && input.salesUsers.length > 0 ? input.salesUsers : defaultSalesUsers,
    notifications: Array.isArray(input.notifications) ? input.notifications : [],
    emailAutomations: Array.isArray(input.emailAutomations) ? input.emailAutomations : [],
    auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs : [],
    importState: {
      marketingLeadIds: Array.isArray(input.importState?.marketingLeadIds) ? input.importState.marketingLeadIds : [],
      marketingEventIds: Array.isArray(input.importState?.marketingEventIds) ? input.importState.marketingEventIds : [],
      onboardingEventIds: Array.isArray(input.importState?.onboardingEventIds) ? input.importState.onboardingEventIds : []
    },
    updatedAt: input.updatedAt ?? nowIso()
  };

  return store;
}

async function readStore(): Promise<CrmStore> {
  const raw = await readJson<CrmStore | null>(STORE_FILE, null);
  if (!raw) {
    return structuredClone(fallbackStore);
  }
  return sanitizeStore(raw);
}

function trimArray<T>(list: T[], max: number) {
  if (list.length <= max) {
    return list;
  }
  return list.slice(0, max);
}

function findLeadByEmail(store: CrmStore, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }
  return store.leads.find((lead) => normalizeEmail(lead.email) === normalized) ?? null;
}

function findLeadByCompany(store: CrmStore, companyName: string | undefined) {
  const normalized = normalizeCompany(companyName);
  if (!normalized) {
    return null;
  }
  return store.leads.find((lead) => normalizeCompany(lead.companyName) === normalized) ?? null;
}

function pickAssignee(store: CrmStore) {
  const active = store.salesUsers.filter((user) => user.active);
  if (active.length === 0) {
    return null;
  }
  return active[store.leads.length % active.length]?.userId ?? null;
}

function addAuditLog(store: CrmStore, leadId: string, action: string, actor: string, payload: Record<string, string>) {
  store.auditLogs.unshift({
    logId: makeId("audit"),
    leadId,
    action,
    actor,
    createdAt: nowIso(),
    payload
  });
  store.auditLogs = trimArray(store.auditLogs, 4000);
}

function queueEmail(
  store: CrmStore,
  leadId: string,
  templateCode: CrmEmailAutomationEvent["templateCode"],
  subject: string,
  triggerReason: string
) {
  const alreadyQueued = store.emailAutomations.some(
    (item) => item.leadId === leadId && item.templateCode === templateCode && item.triggerReason === triggerReason
  );
  if (alreadyQueued) {
    return;
  }

  store.emailAutomations.unshift({
    emailId: makeId("mail"),
    leadId,
    templateCode,
    subject,
    status: "queued",
    triggerReason,
    createdAt: nowIso()
  });
  store.emailAutomations = trimArray(store.emailAutomations, 4000);
}

function addNotification(
  store: CrmStore,
  type: CrmNotification["type"],
  title: string,
  detail: string,
  leadId?: string,
  dedupeKey?: string
) {
  if (dedupeKey) {
    const alreadyExists = store.notifications.some((item) => item.detail.includes(dedupeKey));
    if (alreadyExists) {
      return;
    }
  }

  const nextDetail = dedupeKey ? `${detail} [${dedupeKey}]` : detail;
  store.notifications.unshift({
    notificationId: makeId("ntf"),
    type,
    leadId,
    title,
    detail: nextDetail,
    createdAt: nowIso(),
    read: false
  });
  store.notifications = trimArray(store.notifications, 2000);
}

function addLeadActivity(store: CrmStore, lead: CrmLead, input: ActivityInput) {
  if (input.importKey) {
    const duplicate = store.activities.find(
      (item) => item.leadId === lead.leadId && item.metadata?.importKey === input.importKey
    );
    if (duplicate) {
      return duplicate;
    }
  }

  const previousScore = lead.score;
  const createdAt = input.createdAt ?? nowIso();

  const activity: CrmLeadActivity = {
    activityId: makeId("act"),
    leadId: lead.leadId,
    type: input.type,
    title: input.title,
    detail: input.detail,
    createdAt,
    createdBy: input.createdBy ?? "system",
    metadata: input.importKey
      ? {
          ...(input.metadata ?? {}),
          importKey: input.importKey
        }
      : input.metadata
  };

  store.activities.unshift(activity);
  store.activities = trimArray(store.activities, 10000);

  const scoreDelta = crmScoreRules[input.type] ?? 0;
  if (scoreDelta > 0) {
    lead.score += scoreDelta;
  }

  if (input.type === "demo_requested" && (lead.status === "new" || lead.status === "contacted")) {
    lead.status = "qualified";
  }
  if (input.type === "proposal_sent") {
    lead.status = "proposal_sent";
  }
  if (input.type === "checkout_completed") {
    lead.status = "converted";
    lead.conversionDate = lead.conversionDate ?? createdAt;
  }

  if (previousScore < 60 && lead.score >= 60) {
    addNotification(
      store,
      "high_score",
      "High score lead detected",
      `Lead ${lead.companyName} reached ${lead.score} score.`,
      lead.leadId,
      `high-score-${lead.leadId}`
    );
  }

  if (input.type === "demo_requested") {
    addNotification(
      store,
      "demo_requested",
      "Demo requested",
      `Lead ${lead.companyName} requested a demo.`,
      lead.leadId,
      `demo-request-${lead.leadId}`
    );
    queueEmail(store, lead.leadId, "demo_confirmation", "Demo request received", "demo_requested");
  }

  if (input.type === "checkout_abandoned") {
    queueEmail(store, lead.leadId, "follow_up", "Need help completing checkout?", "checkout_abandoned");
  }

  lead.lastActivityAt = createdAt;
  lead.updatedAt = nowIso();

  return activity;
}

function createLead(store: CrmStore, input: LeadCaptureInput, actor: string) {
  const createdAt = nowIso();
  const lead: CrmLead = {
    leadId: makeId("lead"),
    name: normalizeText(input.name),
    email: normalizeEmail(input.email),
    phone: normalizeText(input.phone) || undefined,
    companyName: normalizeText(input.companyName),
    source: input.source,
    status: input.status ?? "new",
    score: 0,
    assignedTo: input.assignedTo ?? pickAssignee(store),
    createdAt,
    updatedAt: createdAt,
    lastActivityAt: createdAt,
    tenantId: input.tenantId ?? null,
    resellerId: input.resellerId ?? null,
    commissionEligible: input.commissionEligible,
    trialEndsAt: input.trialEndsAt ?? null
  };

  store.leads.unshift(lead);
  store.leads = trimArray(
    store.leads.sort((a, b) => asTimestamp(b.updatedAt) - asTimestamp(a.updatedAt)),
    6000
  );

  addNotification(
    store,
    "new_lead",
    "New lead created",
    `Lead ${lead.companyName} entered pipeline from ${lead.source}.`,
    lead.leadId,
    `new-lead-${lead.leadId}`
  );

  queueEmail(store, lead.leadId, "welcome", "Welcome to LoomaPOS", "lead_created");
  addAuditLog(store, lead.leadId, "lead_created", actor, {
    source: lead.source,
    status: lead.status,
    assignedTo: lead.assignedTo ?? "unassigned"
  });

  addLeadActivity(store, lead, {
    type: "lead_created",
    title: "Lead captured",
    detail: `Source: ${lead.source}`,
    createdBy: actor
  });

  if (lead.source === "demo_request") {
    addLeadActivity(store, lead, {
      type: "demo_requested",
      title: "Demo request registered",
      createdBy: actor
    });
  }

  if (lead.source === "pricing_cta") {
    addLeadActivity(store, lead, {
      type: "pricing_page_visit",
      title: "Pricing intent captured",
      createdBy: actor
    });
  }

  if (lead.source === "download_attempt") {
    addLeadActivity(store, lead, {
      type: "download_attempt",
      title: "Download intent captured",
      createdBy: actor
    });
  }

  if (lead.source === "checkout_start") {
    addLeadActivity(store, lead, {
      type: "signup_started",
      title: "Signup started",
      createdBy: actor
    });
  }

  return lead;
}

function upsertLeadCapture(store: CrmStore, input: LeadCaptureInput, actor: string) {
  const existing = findLeadByEmail(store, input.email);
  if (!existing) {
    return createLead(store, input, actor);
  }

  existing.name = normalizeText(input.name) || existing.name;
  existing.companyName = normalizeText(input.companyName) || existing.companyName;
  existing.phone = normalizeText(input.phone) || existing.phone;
  existing.source = input.source;
  existing.assignedTo = input.assignedTo ?? existing.assignedTo;
  existing.trialEndsAt = input.trialEndsAt ?? existing.trialEndsAt ?? null;
  if (input.status) {
    existing.status = input.status;
  }
  if (input.tenantId !== undefined) {
    existing.tenantId = input.tenantId;
  }
  if (input.resellerId !== undefined) {
    existing.resellerId = input.resellerId;
  }
  if (input.commissionEligible !== undefined) {
    existing.commissionEligible = input.commissionEligible;
  }

  existing.updatedAt = nowIso();

  addAuditLog(store, existing.leadId, "lead_updated", actor, {
    source: existing.source,
    assignedTo: existing.assignedTo ?? "unassigned"
  });

  return existing;
}

function hasActivity(store: CrmStore, leadId: string, type: CrmActivityType) {
  return store.activities.some((item) => item.leadId === leadId && item.type === type);
}

function latestActivity(store: CrmStore, leadId: string, type: CrmActivityType) {
  return store.activities.find((item) => item.leadId === leadId && item.type === type) ?? null;
}

function refreshAutomationSignals(store: CrmStore) {
  const now = Date.now();

  for (const lead of store.leads) {
    if (lead.status !== "converted" && lead.status !== "lost") {
      const lastActivityAt = asTimestamp(lead.lastActivityAt ?? lead.updatedAt);
      const inactiveMs = now - lastActivityAt;
      if (inactiveMs > 1000 * 60 * 60 * 72) {
        addNotification(
          store,
          "lead_inactive",
          "Lead became inactive",
          `Lead ${lead.companyName} has no activity for more than 72 hours.`,
          lead.leadId,
          `inactive-${lead.leadId}`
        );
        queueEmail(store, lead.leadId, "follow_up", "Can we help you continue?", "lead_inactive");
      }
    }

    if (lead.trialEndsAt) {
      const remainingMs = asTimestamp(lead.trialEndsAt) - now;
      if (remainingMs > 0 && remainingMs < 1000 * 60 * 60 * 24 * 3) {
        queueEmail(store, lead.leadId, "trial_expiring", "Your trial is ending soon", "trial_expiring");
      }
    }

    const signupActivity = latestActivity(store, lead.leadId, "signup_started");
    const completedCheckout = hasActivity(store, lead.leadId, "checkout_completed");
    if (signupActivity && !completedCheckout && !hasActivity(store, lead.leadId, "checkout_abandoned")) {
      const age = now - asTimestamp(signupActivity.createdAt);
      if (age > 1000 * 60 * 60 * 6) {
        addLeadActivity(store, lead, {
          type: "checkout_abandoned",
          title: "Checkout appears abandoned",
          detail: "Lead started checkout but did not complete purchase.",
          createdBy: "system"
        });
      }
    }
  }
}

function applyLeadFilters(leads: CrmLead[], filters: CrmLeadFilters) {
  return leads.filter((lead) => {
    if (filters.status && lead.status !== filters.status) {
      return false;
    }
    if (filters.source && lead.source !== filters.source) {
      return false;
    }
    if (filters.assignedTo && lead.assignedTo !== filters.assignedTo) {
      return false;
    }
    if (typeof filters.minScore === "number" && lead.score < filters.minScore) {
      return false;
    }
    if (typeof filters.maxScore === "number" && lead.score > filters.maxScore) {
      return false;
    }
    if (filters.query) {
      const query = filters.query.toLowerCase();
      const haystack = `${lead.name} ${lead.companyName} ${lead.email}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (filters.dateFrom && asTimestamp(lead.createdAt) < asTimestamp(filters.dateFrom)) {
      return false;
    }
    if (filters.dateTo && asTimestamp(lead.createdAt) > asTimestamp(filters.dateTo)) {
      return false;
    }
    return true;
  });
}

function buildMetrics(store: CrmStore): CrmDashboardMetrics {
  const distribution = emptyPipelineDistribution();
  for (const lead of store.leads) {
    distribution[lead.status] += 1;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const newLeadsToday = store.leads.filter((lead) => asTimestamp(lead.createdAt) >= todayStart.getTime()).length;
  const converted = store.leads.filter((lead) => lead.status === "converted").length;

  const topSalesReps = store.salesUsers
    .map((user) => {
      const assigned = store.leads.filter((lead) => lead.assignedTo === user.userId).length;
      const convertedCount = store.leads.filter(
        (lead) => lead.assignedTo === user.userId && lead.status === "converted"
      ).length;
      return {
        userId: user.userId,
        name: user.name,
        assigned,
        converted: convertedCount
      };
    })
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 5);

  const sourcePerformance = crmLeadSources.map((source) => {
    const leads = store.leads.filter((lead) => lead.source === source);
    return {
      source,
      leads: leads.length,
      converted: leads.filter((lead) => lead.status === "converted").length
    };
  });

  const abandonedCheckoutLeadIds = new Set(
    store.activities
      .filter((item) => item.type === "checkout_abandoned")
      .map((item) => item.leadId)
  );

  return {
    totalLeads: store.leads.length,
    newLeadsToday,
    conversionRate: store.leads.length === 0 ? 0 : Number(((converted / store.leads.length) * 100).toFixed(2)),
    pipelineDistribution: distribution,
    topSalesReps,
    sourcePerformance,
    highScoreLeads: store.leads.filter((lead) => lead.score >= 60).length,
    abandonedCheckoutLeads: abandonedCheckoutLeadIds.size
  };
}

function mapMarketingEventToActivity(event: StoredMarketingEvent): CrmActivityType | null {
  if (event.type === "page_view" && event.path.toLowerCase().includes("/pricing")) {
    return "pricing_page_visit";
  }

  const href = (event.href ?? "").toLowerCase();
  if (event.type === "cta_click" && (href.includes("/checkout") || event.path.toLowerCase().includes("/checkout"))) {
    return "signup_started";
  }
  if (event.type === "cta_click" && (href.includes("/download") || event.path.toLowerCase().includes("/download"))) {
    return "download_attempt";
  }
  if (event.type === "lead_submit" && (event.label ?? "").toLowerCase() === "demo") {
    return "demo_requested";
  }

  return null;
}

async function syncMarketingLeads(store: CrmStore) {
  const leads = await readJson<StoredMarketingLead[]>(MARKETING_LEADS_FILE, []);
  for (const lead of leads) {
    if (store.importState.marketingLeadIds.includes(lead.id)) {
      continue;
    }

    const source: CrmLeadSource = lead.type === "demo" ? "demo_request" : "contact_form";
    const target = upsertLeadCapture(
      store,
      {
        name: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        source
      },
      "system:marketing_import"
    );

    addLeadActivity(store, target, {
      type: "lead_created",
      title: "Imported from marketing lead form",
      detail: `${lead.sourcePath} - ${lead.type}`,
      createdBy: "system:marketing_import",
      createdAt: lead.createdAt,
      importKey: `marketing-lead-${lead.id}`
    });

    if (lead.type === "demo") {
      addLeadActivity(store, target, {
        type: "demo_requested",
        title: "Demo requested from marketing form",
        detail: lead.message,
        createdBy: "system:marketing_import",
        createdAt: lead.createdAt,
        importKey: `marketing-lead-demo-${lead.id}`
      });
    }

    store.importState.marketingLeadIds.unshift(lead.id);
  }
  store.importState.marketingLeadIds = trimArray(store.importState.marketingLeadIds, 12000);
}

async function syncMarketingEvents(store: CrmStore) {
  const events = await readJson<StoredMarketingEvent[]>(MARKETING_EVENTS_FILE, []);
  for (const event of events) {
    if (store.importState.marketingEventIds.includes(event.id)) {
      continue;
    }

    const mappedType = mapMarketingEventToActivity(event);
    if (mappedType) {
      const lead = findLeadByCompany(store, event.source);
      if (lead) {
        addLeadActivity(store, lead, {
          type: mappedType,
          title: `Behavior signal: ${mappedType}`,
          detail: event.path,
          createdAt: event.createdAt,
          createdBy: "system:marketing_event",
          metadata: {
            source: event.source ?? "",
            medium: event.medium ?? "",
            campaign: event.campaign ?? "",
            context: event.context ?? ""
          },
          importKey: `marketing-event-${event.id}`
        });
      }
    }

    store.importState.marketingEventIds.unshift(event.id);
  }
  store.importState.marketingEventIds = trimArray(store.importState.marketingEventIds, 20000);
}

async function syncOnboardingEvents(store: CrmStore) {
  const events = await readJson<StoredOnboardingEvent[]>(ONBOARDING_EVENTS_FILE, []);
  for (const event of events) {
    if (store.importState.onboardingEventIds.includes(event.id)) {
      continue;
    }

    const code = normalizeText(event.stepCode).toLowerCase();
    if (
      event.type === "step_completed" &&
      event.tenantId &&
      (code === "first_sale" || code === "first_test_sale")
    ) {
      const lead = store.leads.find((item) => item.tenantId === event.tenantId);
      if (lead) {
        addLeadActivity(store, lead, {
          type: "onboarding_completed",
          title: "First sale completed",
          detail: "Tenant finished onboarding and first sale step.",
          createdAt: event.createdAt,
          createdBy: "system:onboarding_event",
          importKey: `onboarding-event-${event.id}`
        });
      }
    }

    store.importState.onboardingEventIds.unshift(event.id);
  }
  store.importState.onboardingEventIds = trimArray(store.importState.onboardingEventIds, 20000);
}

async function loadStoreWithSync() {
  const store = await readStore();
  await syncMarketingLeads(store);
  await syncMarketingEvents(store);
  await syncOnboardingEvents(store);
  refreshAutomationSignals(store);

  store.leads = trimArray(
    store.leads.sort((a, b) => asTimestamp(b.updatedAt) - asTimestamp(a.updatedAt)),
    6000
  );
  store.updatedAt = nowIso();
  await writeStore(store);
  return store;
}

function inferSourceForEvent(input: BehaviorEventInput): CrmLeadSource {
  if (input.source && isCrmLeadSource(input.source)) {
    return input.source;
  }

  if (input.eventType === "demo_requested") {
    return "demo_request";
  }
  if (input.eventType === "download_attempt") {
    return "download_attempt";
  }
  if (input.eventType === "signup_started") {
    return "checkout_start";
  }
  if (input.eventType === "pricing_page_visit") {
    return "pricing_cta";
  }
  if (input.eventType === "newsletter_signup") {
    return "newsletter_signup";
  }

  return "manual_import";
}

export async function listCrmLeads(filters: CrmLeadFilters = {}): Promise<CrmLeadListResponse> {
  const store = await loadStoreWithSync();
  const leads = applyLeadFilters(store.leads, filters);

  return {
    leads,
    metrics: buildMetrics(store),
    salesUsers: store.salesUsers,
    notifications: store.notifications.slice(0, 40)
  };
}

export async function getCrmLeadDetail(leadId: string): Promise<CrmLeadDetailResponse | null> {
  const store = await loadStoreWithSync();
  const lead = store.leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  return {
    lead,
    activities: store.activities.filter((item) => item.leadId === leadId),
    notes: store.notes.filter((item) => item.leadId === leadId),
    demos: store.demos.filter((item) => item.leadId === leadId),
    audit: store.auditLogs.filter((item) => item.leadId === leadId)
  };
}

export async function createOrUpdateCrmLead(input: LeadCaptureInput, actor = "system") {
  const store = await loadStoreWithSync();
  const lead = upsertLeadCapture(store, input, actor);
  store.updatedAt = nowIso();
  await writeStore(store);
  return lead;
}

export async function updateCrmLead(leadId: string, patch: LeadPatchInput, actor = "system") {
  const store = await loadStoreWithSync();
  const lead = store.leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  const previousStatus = lead.status;
  const previousAssignee = lead.assignedTo ?? null;

  if (patch.status && isCrmLeadStatus(patch.status)) {
    lead.status = patch.status;
  }
  if (patch.assignedTo !== undefined) {
    lead.assignedTo = patch.assignedTo;
  }
  if (typeof patch.scoreDelta === "number" && patch.scoreDelta !== 0) {
    lead.score += patch.scoreDelta;
  }
  if (patch.tenantId !== undefined) {
    lead.tenantId = patch.tenantId;
  }
  if (patch.resellerId !== undefined) {
    lead.resellerId = patch.resellerId;
  }
  if (patch.commissionEligible !== undefined) {
    lead.commissionEligible = patch.commissionEligible;
  }
  if (patch.conversionDate !== undefined) {
    lead.conversionDate = patch.conversionDate;
  }
  if (patch.lostReason !== undefined) {
    lead.lostReason = patch.lostReason;
  }
  if (patch.trialEndsAt !== undefined) {
    lead.trialEndsAt = patch.trialEndsAt;
  }

  if (lead.status === "converted" && !lead.conversionDate) {
    lead.conversionDate = nowIso();
  }

  if (lead.status !== previousStatus) {
    addLeadActivity(store, lead, {
      type: "status_changed",
      title: `Status moved to ${lead.status}`,
      detail: `Previous status: ${previousStatus}`,
      createdBy: actor
    });
  }

  if (lead.assignedTo !== previousAssignee) {
    addAuditLog(store, lead.leadId, "assignment_updated", actor, {
      previousAssignee: previousAssignee ?? "unassigned",
      nextAssignee: lead.assignedTo ?? "unassigned"
    });
  }

  if (patch.scoreDelta) {
    addLeadActivity(store, lead, {
      type: "manual_update",
      title: `Score adjusted by ${patch.scoreDelta}`,
      createdBy: actor
    });
  }

  addAuditLog(store, lead.leadId, "lead_patch", actor, {
    status: lead.status,
    assignedTo: lead.assignedTo ?? "unassigned",
    score: String(lead.score)
  });

  lead.updatedAt = nowIso();
  store.updatedAt = nowIso();
  await writeStore(store);
  return lead;
}

export async function addCrmLeadActivity(leadId: string, input: ActivityInput, actor = "system") {
  const store = await loadStoreWithSync();
  const lead = store.leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  const activity = addLeadActivity(store, lead, {
    ...input,
    createdBy: input.createdBy ?? actor
  });

  addAuditLog(store, leadId, "activity_added", actor, {
    type: input.type,
    title: input.title
  });

  store.updatedAt = nowIso();
  await writeStore(store);
  return activity;
}

export async function addCrmLeadNote(leadId: string, note: string, actor = "system") {
  const store = await loadStoreWithSync();
  const lead = store.leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  const item: CrmLeadNote = {
    noteId: makeId("note"),
    leadId,
    note: normalizeText(note),
    createdAt: nowIso(),
    createdBy: actor
  };

  store.notes.unshift(item);
  store.notes = trimArray(store.notes, 5000);

  addLeadActivity(store, lead, {
    type: "note_added",
    title: "Note added",
    detail: item.note,
    createdBy: actor
  });

  addAuditLog(store, leadId, "note_added", actor, { note: item.note });
  store.updatedAt = nowIso();
  await writeStore(store);
  return item;
}

export async function scheduleCrmDemo(leadId: string, input: DemoInput, actor = "system") {
  const store = await loadStoreWithSync();
  const lead = store.leads.find((item) => item.leadId === leadId);
  if (!lead) {
    return null;
  }

  const existing = store.demos.find((item) => item.leadId === leadId);
  const demo: CrmDemoSchedule = existing
    ? {
        ...existing,
        date: normalizeText(input.date),
        time: normalizeText(input.time),
        assignedSalesRep: normalizeText(input.assignedSalesRep),
        meetingLink: normalizeText(input.meetingLink) || undefined,
        status: input.status,
        updatedAt: nowIso()
      }
    : {
        demoId: makeId("demo"),
        leadId,
        date: normalizeText(input.date),
        time: normalizeText(input.time),
        assignedSalesRep: normalizeText(input.assignedSalesRep),
        meetingLink: normalizeText(input.meetingLink) || undefined,
        status: input.status,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };

  store.demos = [demo, ...store.demos.filter((item) => item.leadId !== leadId)];
  store.demos = trimArray(store.demos, 3000);

  if (demo.status === "scheduled") {
    lead.status = "demo_scheduled";
    addLeadActivity(store, lead, {
      type: "demo_requested",
      title: "Demo scheduled",
      detail: `${demo.date} ${demo.time}`,
      createdBy: actor
    });
    queueEmail(store, lead.leadId, "demo_confirmation", "Demo schedule confirmation", "demo_scheduled");
  }

  addAuditLog(store, lead.leadId, "demo_updated", actor, {
    status: demo.status,
    date: demo.date,
    time: demo.time
  });

  store.updatedAt = nowIso();
  await writeStore(store);
  return demo;
}

export async function getCrmDashboard() {
  const store = await loadStoreWithSync();
  return {
    metrics: buildMetrics(store),
    emailAutomations: store.emailAutomations.slice(0, 60),
    notifications: store.notifications.slice(0, 60),
    salesUsers: store.salesUsers
  };
}

export async function trackCrmBehaviorEvent(input: BehaviorEventInput) {
  const store = await loadStoreWithSync();
  const actor = normalizeText(input.actor) || "system:behavior";

  const source = inferSourceForEvent(input);
  const email = normalizeEmail(input.email);
  const companyName = normalizeText(input.companyName);
  const name = normalizeText(input.name) || companyName || "Website visitor";

  let lead = findLeadByEmail(store, email);
  if (!lead && companyName) {
    lead = findLeadByCompany(store, companyName);
  }

  if (!lead && (email || companyName)) {
    lead = createLead(
      store,
      {
        name,
        email: email || `${makeId("lead")}@unknown.local`,
        companyName: companyName || "Unknown Company",
        phone: normalizeText(input.phone) || undefined,
        source,
        tenantId: input.tenantId ?? null,
        resellerId: input.resellerId ?? null,
        commissionEligible: input.commissionEligible
      },
      actor
    );
  }

  if (!lead) {
    await writeStore(store);
    return { lead: null, eventAccepted: true };
  }

  if (input.tenantId) {
    lead.tenantId = input.tenantId;
  }
  if (input.resellerId) {
    lead.resellerId = input.resellerId;
  }
  if (input.commissionEligible !== undefined) {
    lead.commissionEligible = input.commissionEligible;
  }

  const eventType = input.eventType;
  if (eventType === "newsletter_signup") {
    addLeadActivity(store, lead, {
      type: "lead_created",
      title: "Newsletter signup",
      detail: input.detail ?? "Newsletter subscription captured.",
      createdBy: actor
    });
  } else {
    const mappedType = eventType === "pricing_page_visit" ? "pricing_page_visit" : eventType;
    addLeadActivity(store, lead, {
      type: mappedType,
      title: `Behavior event: ${mappedType}`,
      detail: input.detail ?? input.path,
      createdBy: actor,
      metadata: input.path
        ? {
            path: input.path
          }
        : undefined
    });
  }

  if (eventType === "checkout_completed") {
    lead.status = "converted";
    lead.conversionDate = lead.conversionDate ?? nowIso();
  }

  store.updatedAt = nowIso();
  await writeStore(store);
  return { lead, eventAccepted: true };
}
