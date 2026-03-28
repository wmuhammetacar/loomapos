import { promises as fs } from "fs";
import path from "path";
import { listCrmLeads, updateCrmLead } from "@/lib/crm-store";
import type { CrmLead } from "@/lib/crm-types";
import {
  resellerApplicationStatuses,
  resellerCommissionStatuses,
  resellerCommissionTriggerTypes,
  resellerLeadAssignmentModes,
  resellerPayoutStatuses,
  resellerStatuses,
  resellerTiers,
  type ReferralConversionRecord,
  type ResellerApplicationInput,
  type ResellerApplicationRecord,
  type ResellerCommissionRecord,
  type ResellerCommissionRule,
  type ResellerCommissionStatus,
  type ResellerCommissionTriggerType,
  type ResellerDetailWorkspace,
  type ResellerFraudFlag,
  type ResellerGrowthDashboard,
  type ResellerGrowthStoreSnapshot,
  type ResellerLeadAssignment,
  type ResellerLeadAssignmentMode,
  type ResellerLeadSummary,
  type ResellerNotificationRecord,
  type ResellerPayoutRecord,
  type ResellerPayoutStatus,
  type ResellerPerformanceMetrics,
  type ResellerProfile,
  type ResellerStatus,
  type ResellerTier
} from "@/lib/reseller-growth-types";

const DATA_DIR = path.join(process.cwd(), ".reseller-growth-data");
const STORE_FILE = path.join(DATA_DIR, "reseller-growth-store.json");

export const resellerPartnerAssets = [
  { id: "asset-brochure", title: "Product brochure", href: "/download", type: "sales" },
  { id: "asset-demo-kit", title: "Demo video kit", href: "/demo", type: "enablement" },
  { id: "asset-pricing", title: "Pricing sheet", href: "/pricing", type: "pricing" },
  { id: "asset-script", title: "Sales script pack", href: "/docs", type: "script" }
] as const;

export const resellerTrainingModules = [
  {
    id: "training-pos-value",
    title: "How to sell POS value",
    level: "starter",
    href: "/docs/getting-started"
  },
  {
    id: "training-rollout",
    title: "Onboarding customer rollout",
    level: "intermediate",
    href: "/docs/installation"
  },
  {
    id: "training-support",
    title: "Partner support playbook",
    level: "intermediate",
    href: "/docs/license-activation"
  },
  {
    id: "training-growth",
    title: "Channel growth and retention",
    level: "advanced",
    href: "/blog"
  }
] as const;

export interface ResellerProfileListFilters {
  status?: ResellerStatus;
  region?: string;
  query?: string;
}

export interface ResellerProfileSummary {
  reseller: ResellerProfile;
  metrics: ResellerPerformanceMetrics;
}

export interface AssignableCrmLeadSummary {
  leadId: string;
  name: string;
  email: string;
  companyName: string;
  status: string;
  score: number;
  source: string;
  createdAt: string;
  assignedResellerId?: string | null;
}

interface ReviewApplicationInput {
  decision: "approved" | "rejected";
  reviewer: string;
  note?: string;
  commissionRate?: number;
}

interface AssignLeadInput {
  leadId: string;
  resellerId: string;
  assignedBy: string;
  mode: ResellerLeadAssignmentMode;
  regionBasis?: string;
  performanceBasis?: string;
  overrideReason?: string;
}

interface TrackReferralInput {
  referralCode: string;
  eventType: "visit" | "signup" | "purchase";
  path?: string;
  source?: string;
  leadId?: string;
  customerId?: string;
  amount?: number;
  visitorEmail?: string;
}

interface CreateCommissionInput {
  resellerId: string;
  customerId: string;
  leadId?: string;
  amount?: number;
  triggerType: ResellerCommissionTriggerType;
}

interface CreatePayoutInput {
  resellerId: string;
  commissionIds?: string[];
}

interface UpdateProfileInput {
  status?: ResellerStatus;
  region?: string;
  commissionRate?: number;
  tier?: ResellerTier;
}

const fallbackStore: ResellerGrowthStoreSnapshot = {
  applications: [
    {
      applicationId: "app_partner_001",
      name: "Meral Akin",
      companyName: "Marmara Retail Danismanlik",
      email: "meral@marmararetail.test",
      phone: "+90 532 222 00 01",
      businessType: "Consulting",
      experience: "5 years of POS rollout projects for retail chains.",
      region: "Marmara",
      status: "approved",
      submittedAt: "2026-03-05T08:30:00Z",
      updatedAt: "2026-03-06T09:20:00Z",
      reviewedAt: "2026-03-06T09:20:00Z",
      reviewedBy: "admin:channel_manager",
      reviewNote: "Approved after channel interview.",
      resellerId: "reseller_ist_001"
    },
    {
      applicationId: "app_partner_002",
      name: "Cem Oz",
      companyName: "Ege POS Cozumleri",
      email: "cem@egepos.test",
      phone: "+90 532 222 00 02",
      businessType: "Regional distributor",
      experience: "",
      region: "Ege",
      status: "under_review",
      submittedAt: "2026-03-10T11:00:00Z",
      updatedAt: "2026-03-10T11:00:00Z",
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      resellerId: null
    }
  ],
  resellers: [
    {
      resellerId: "reseller_ist_001",
      name: "Meral Akin",
      companyName: "Marmara Retail Danismanlik",
      email: "meral@marmararetail.test",
      phone: "+90 532 222 00 01",
      status: "active",
      region: "Marmara",
      commissionRate: 0.12,
      referralCode: "MRM8A1",
      tier: "Gold",
      createdAt: "2026-03-06T09:20:00Z",
      updatedAt: "2026-03-12T14:00:00Z"
    }
  ],
  leadAssignments: [
    {
      assignmentId: "assign_001",
      leadId: "lead_demo_001",
      resellerId: "reseller_ist_001",
      assignedAt: "2026-03-12T10:00:00Z",
      assignedBy: "admin:auto",
      mode: "auto_region",
      regionBasis: "Marmara",
      performanceBasis: null,
      overrideReason: null
    }
  ],
  referralVisits: [
    {
      visitId: "ref_visit_001",
      resellerId: "reseller_ist_001",
      referralCode: "MRM8A1",
      path: "/pricing",
      source: "google",
      createdAt: "2026-03-12T08:00:00Z"
    }
  ],
  referralConversions: [
    {
      conversionId: "ref_conv_001",
      resellerId: "reseller_ist_001",
      referralCode: "MRM8A1",
      conversionType: "signup",
      leadId: "lead_demo_001",
      customerId: null,
      amount: null,
      createdAt: "2026-03-12T08:05:00Z"
    }
  ],
  commissionRules: [
    {
      ruleId: "rule_percent_default",
      name: "Default subscription %",
      kind: "percent",
      value: 0.12,
      active: true
    },
    {
      ruleId: "rule_fixed_promo",
      name: "Fixed campaign bonus",
      kind: "fixed",
      value: 500,
      active: false
    },
    {
      ruleId: "rule_tiered",
      name: "Tiered growth bonus",
      kind: "tiered",
      value: 0.1,
      tierThresholds: [
        { tier: "Bronze", value: 0.1 },
        { tier: "Silver", value: 0.12 },
        { tier: "Gold", value: 0.14 },
        { tier: "Platinum", value: 0.16 }
      ],
      active: true
    }
  ],
  commissions: [
    {
      commissionId: "comm_001",
      resellerId: "reseller_ist_001",
      customerId: "tenant-demo-1",
      leadId: "lead_demo_001",
      amount: 2850,
      status: "approved",
      triggerType: "new_subscription",
      ruleId: "rule_tiered",
      createdAt: "2026-03-13T12:00:00Z",
      approvedAt: "2026-03-14T10:00:00Z",
      paidAt: null
    }
  ],
  payouts: [
    {
      payoutId: "payout_001",
      resellerId: "reseller_ist_001",
      amount: 2850,
      payoutDate: null,
      status: "processing",
      commissionIds: ["comm_001"],
      createdAt: "2026-03-15T09:00:00Z",
      updatedAt: "2026-03-15T09:00:00Z"
    }
  ],
  notifications: [
    {
      notificationId: "note_001",
      resellerId: "reseller_ist_001",
      type: "lead_assigned",
      title: "New lead assigned",
      detail: "Lead lead_demo_001 has been assigned to your channel account.",
      createdAt: "2026-03-12T10:00:00Z",
      read: false
    }
  ],
  fraudFlags: [],
  updatedAt: new Date().toISOString()
};

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

function asTimestamp(value: string | undefined | null) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isResellerStatus(value: string): value is ResellerStatus {
  return resellerStatuses.includes(value as ResellerStatus);
}

function isCommissionStatus(value: string): value is ResellerCommissionStatus {
  return resellerCommissionStatuses.includes(value as ResellerCommissionStatus);
}

function isPayoutStatus(value: string): value is ResellerPayoutStatus {
  return resellerPayoutStatuses.includes(value as ResellerPayoutStatus);
}

function isAssignmentMode(value: string): value is ResellerLeadAssignmentMode {
  return resellerLeadAssignmentModes.includes(value as ResellerLeadAssignmentMode);
}

function isTriggerType(value: string): value is ResellerCommissionTriggerType {
  return resellerCommissionTriggerTypes.includes(value as ResellerCommissionTriggerType);
}

function isApplicationStatus(value: string): value is ResellerApplicationRecord["status"] {
  return resellerApplicationStatuses.includes(value as ResellerApplicationRecord["status"]);
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readStore(): Promise<ResellerGrowthStoreSnapshot> {
  const snapshot = await readJson(STORE_FILE, fallbackStore);
  return {
    ...snapshot,
    applications: snapshot.applications ?? [],
    resellers: snapshot.resellers ?? [],
    leadAssignments: snapshot.leadAssignments ?? [],
    referralVisits: snapshot.referralVisits ?? [],
    referralConversions: snapshot.referralConversions ?? [],
    commissionRules: snapshot.commissionRules ?? [],
    commissions: snapshot.commissions ?? [],
    payouts: snapshot.payouts ?? [],
    notifications: snapshot.notifications ?? [],
    fraudFlags: snapshot.fraudFlags ?? [],
    updatedAt: snapshot.updatedAt ?? nowIso()
  };
}

async function writeStore(store: ResellerGrowthStoreSnapshot) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function buildReferralCode(companyName: string, existingCodes: Set<string>) {
  const cleaned = companyName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const seed = cleaned.slice(0, 3) || "RSL";

  let code = "";
  do {
    code = `${seed}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  } while (existingCodes.has(code));

  return code;
}

function addNotification(
  store: ResellerGrowthStoreSnapshot,
  resellerId: string,
  type: ResellerNotificationRecord["type"],
  title: string,
  detail: string
) {
  store.notifications.unshift({
    notificationId: makeId("notif"),
    resellerId,
    type,
    title,
    detail,
    createdAt: nowIso(),
    read: false
  });

  store.notifications = store.notifications
    .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
    .slice(0, 5000);
}

function addFraudFlag(
  store: ResellerGrowthStoreSnapshot,
  input: Omit<ResellerFraudFlag, "flagId" | "createdAt" | "resolved">
) {
  store.fraudFlags.unshift({
    flagId: makeId("fraud"),
    resellerId: input.resellerId ?? null,
    leadId: input.leadId ?? null,
    code: input.code,
    detail: input.detail,
    resolved: false,
    createdAt: nowIso()
  });

  store.fraudFlags = store.fraudFlags
    .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
    .slice(0, 4000);
}

function resolveCommissionRule(store: ResellerGrowthStoreSnapshot) {
  const preferred =
    store.commissionRules.find((rule) => rule.active && rule.kind === "tiered") ??
    store.commissionRules.find((rule) => rule.active);

  return (
    preferred ?? {
      ruleId: "rule_fallback",
      name: "Fallback percent",
      kind: "percent",
      value: 0.1,
      active: true
    }
  );
}

function commissionAmountFromRule(
  rule: ResellerCommissionRule,
  baseAmount: number,
  tier: ResellerTier
) {
  if (rule.kind === "fixed") {
    return Math.max(0, rule.value);
  }

  if (rule.kind === "tiered") {
    const matched = rule.tierThresholds?.find((item) => item.tier === tier);
    const rate = matched?.value ?? rule.value;
    return Math.max(0, baseAmount * rate);
  }

  return Math.max(0, baseAmount * rule.value);
}

function deriveTier(metrics: ResellerPerformanceMetrics): ResellerTier {
  if (metrics.revenue >= 600000 || metrics.conversionCount >= 120) {
    return "Platinum";
  }

  if (metrics.revenue >= 250000 || metrics.conversionCount >= 60) {
    return "Gold";
  }

  if (metrics.revenue >= 80000 || metrics.conversionCount >= 25) {
    return "Silver";
  }

  return "Bronze";
}

async function loadCrmLeads() {
  try {
    const response = await listCrmLeads();
    return response.leads;
  } catch {
    return [] as CrmLead[];
  }
}

function ownedLeadIds(store: ResellerGrowthStoreSnapshot, resellerId: string) {
  const assigned = store.leadAssignments
    .filter((item) => item.resellerId === resellerId)
    .map((item) => item.leadId);

  return new Set(assigned);
}

function ownedLeads(
  store: ResellerGrowthStoreSnapshot,
  resellerId: string,
  crmLeads: CrmLead[]
) {
  const assignedLeadIds = ownedLeadIds(store, resellerId);
  return crmLeads.filter(
    (lead) => lead.resellerId === resellerId || assignedLeadIds.has(lead.leadId)
  );
}

function deriveMetrics(
  store: ResellerGrowthStoreSnapshot,
  resellerId: string,
  crmLeads: CrmLead[]
): ResellerPerformanceMetrics {
  const leads = ownedLeads(store, resellerId, crmLeads);
  const commissions = store.commissions.filter((item) => item.resellerId === resellerId);

  const leadsGenerated = leads.length;
  const conversionCount = leads.filter((item) => item.status === "converted").length;
  const conversionRate = leadsGenerated > 0 ? (conversionCount / leadsGenerated) * 100 : 0;
  const revenue = commissions.reduce((sum, item) => sum + item.amount, 0);
  const churnCount = leads.filter((item) => item.status === "lost").length;
  const churnRate = leadsGenerated > 0 ? (churnCount / leadsGenerated) * 100 : 0;
  const activeCustomers = new Set(commissions.map((item) => item.customerId)).size;
  const pendingCommission = commissions
    .filter((item) => item.status === "pending" || item.status === "approved")
    .reduce((sum, item) => sum + item.amount, 0);
  const paidCommission = commissions
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    leadsGenerated,
    conversionCount,
    conversionRate: Number(conversionRate.toFixed(2)),
    revenue,
    churnRate: Number(churnRate.toFixed(2)),
    activeCustomers,
    pendingCommission,
    paidCommission
  };
}

function buildLeadSummary(lead: CrmLead): ResellerLeadSummary {
  return {
    leadId: lead.leadId,
    name: lead.name,
    companyName: lead.companyName,
    email: lead.email,
    status: lead.status,
    score: lead.score,
    createdAt: lead.createdAt,
    convertedAt: lead.conversionDate ?? null
  };
}

function keepLatest<T extends { createdAt?: string; updatedAt?: string }>(
  list: T[],
  max = 5000
) {
  return list
    .sort((a, b) => {
      const left = asTimestamp(a.updatedAt ?? a.createdAt ?? null);
      const right = asTimestamp(b.updatedAt ?? b.createdAt ?? null);
      return right - left;
    })
    .slice(0, max);
}

function ensureTierConsistency(
  store: ResellerGrowthStoreSnapshot,
  crmLeads: CrmLead[]
) {
  for (const reseller of store.resellers) {
    const metrics = deriveMetrics(store, reseller.resellerId, crmLeads);
    reseller.tier = deriveTier(metrics);
    reseller.updatedAt = nowIso();
  }
}

function ensureAutoCommissions(
  store: ResellerGrowthStoreSnapshot,
  crmLeads: CrmLead[]
) {
  const rule = resolveCommissionRule(store);

  for (const lead of crmLeads) {
    if (lead.status !== "converted" || !lead.resellerId || lead.commissionEligible === false) {
      continue;
    }

    const reseller = store.resellers.find((item) => item.resellerId === lead.resellerId);
    if (!reseller) {
      continue;
    }

    const exists = store.commissions.some(
      (item) => item.leadId === lead.leadId && item.triggerType === "new_subscription"
    );
    if (exists) {
      continue;
    }

    const baseAmount = Math.max(2500, lead.score * 50);
    const amount = Number(
      commissionAmountFromRule(rule, baseAmount, reseller.tier).toFixed(2)
    );

    store.commissions.unshift({
      commissionId: makeId("comm"),
      resellerId: reseller.resellerId,
      customerId: lead.tenantId ?? lead.companyName,
      leadId: lead.leadId,
      amount,
      status: "pending",
      triggerType: "new_subscription",
      ruleId: rule.ruleId,
      createdAt: nowIso(),
      approvedAt: null,
      paidAt: null
    });

    addNotification(
      store,
      reseller.resellerId,
      "lead_converted",
      "Lead converted",
      `${lead.companyName} was converted and linked to your channel account.`
    );
    addNotification(
      store,
      reseller.resellerId,
      "commission_earned",
      "Commission generated",
      `A new ${amount.toFixed(2)} TRY commission entry was created from converted lead ${lead.leadId}.`
    );
  }

  store.commissions = keepLatest(store.commissions, 8000);
}

async function loadStoreWithSync() {
  const store = await readStore();
  const crmLeads = await loadCrmLeads();

  ensureAutoCommissions(store, crmLeads);
  ensureTierConsistency(store, crmLeads);

  store.applications = keepLatest(store.applications, 4000);
  store.leadAssignments = store.leadAssignments
    .sort((a, b) => asTimestamp(b.assignedAt) - asTimestamp(a.assignedAt))
    .slice(0, 9000);
  store.referralVisits = keepLatest(store.referralVisits, 20000);
  store.referralConversions = keepLatest(store.referralConversions, 20000);
  store.payouts = keepLatest(store.payouts, 4000);
  store.updatedAt = nowIso();

  await writeStore(store);
  return { store, crmLeads };
}

export async function submitResellerApplication(input: ResellerApplicationInput) {
  const name = normalizeText(input.name);
  const companyName = normalizeText(input.companyName);
  const email = normalizeEmail(input.email);
  const phone = normalizeText(input.phone);
  const businessType = normalizeText(input.businessType);
  const experience = normalizeText(input.experience);
  const region = normalizeText(input.region);

  if (!name || !companyName || !email || !businessType || !region) {
    throw new Error("name, companyName, email, businessType and region are required.");
  }

  const { store } = await loadStoreWithSync();

  const existingReseller = store.resellers.find(
    (item) => normalizeEmail(item.email) === email
  );

  if (existingReseller) {
    addFraudFlag(store, {
      resellerId: existingReseller.resellerId,
      leadId: null,
      code: "duplicate_account",
      detail: `Duplicate reseller application attempted for ${email}.`
    });
    store.updatedAt = nowIso();
    await writeStore(store);
    throw new Error("This email already belongs to an existing reseller account.");
  }

  const pending = store.applications.find(
    (item) =>
      normalizeEmail(item.email) === email &&
      (item.status === "submitted" || item.status === "under_review")
  );

  if (pending) {
    return pending;
  }

  const duplicateCompany = store.applications.some(
    (item) => normalizeText(item.companyName).toLowerCase() === companyName.toLowerCase()
  );

  if (duplicateCompany) {
    addFraudFlag(store, {
      resellerId: null,
      leadId: null,
      code: "duplicate_account",
      detail: `Multiple applications submitted for company ${companyName}.`
    });
  }

  const createdAt = nowIso();
  const application: ResellerApplicationRecord = {
    applicationId: makeId("app"),
    name,
    companyName,
    email,
    phone: phone || undefined,
    businessType,
    experience: experience || undefined,
    region,
    status: "submitted",
    submittedAt: createdAt,
    updatedAt: createdAt,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null,
    resellerId: null
  };

  store.applications.unshift(application);
  store.updatedAt = nowIso();
  await writeStore(store);

  return application;
}

export async function listResellerApplications(status?: ResellerApplicationRecord["status"]) {
  const { store } = await loadStoreWithSync();
  const normalized = status && isApplicationStatus(status) ? status : undefined;

  return store.applications.filter((item) => (normalized ? item.status === normalized : true));
}

export async function reviewResellerApplication(
  applicationId: string,
  input: ReviewApplicationInput
) {
  const { store, crmLeads } = await loadStoreWithSync();
  const application = store.applications.find((item) => item.applicationId === applicationId);

  if (!application) {
    throw new Error("Application not found.");
  }

  if (application.status === "approved" || application.status === "rejected") {
    return {
      application,
      reseller: application.resellerId
        ? store.resellers.find((item) => item.resellerId === application.resellerId) ?? null
        : null
    };
  }

  const reviewer = normalizeText(input.reviewer) || "admin:channel_manager";
  const note = normalizeText(input.note);
  const now = nowIso();

  application.status = input.decision;
  application.reviewedAt = now;
  application.reviewedBy = reviewer;
  application.reviewNote = note || null;
  application.updatedAt = now;

  let reseller: ResellerProfile | null = null;
  if (input.decision === "approved") {
    const existing = store.resellers.find(
      (item) => normalizeEmail(item.email) === normalizeEmail(application.email)
    );

    if (existing) {
      existing.status = "active";
      existing.region = application.region;
      existing.commissionRate =
        typeof input.commissionRate === "number" && input.commissionRate > 0
          ? input.commissionRate
          : existing.commissionRate;
      existing.updatedAt = now;
      reseller = existing;
    } else {
      const existingCodes = new Set(store.resellers.map((item) => item.referralCode));
      const newReseller: ResellerProfile = {
        resellerId: makeId("reseller"),
        name: application.name,
        companyName: application.companyName,
        email: application.email,
        phone: application.phone,
        status: "active",
        region: application.region,
        commissionRate:
          typeof input.commissionRate === "number" && input.commissionRate > 0
            ? input.commissionRate
            : 0.12,
        referralCode: buildReferralCode(application.companyName, existingCodes),
        tier: "Bronze",
        createdAt: now,
        updatedAt: now
      };

      store.resellers.unshift(newReseller);
      reseller = newReseller;
    }

    application.resellerId = reseller.resellerId;
    addNotification(
      store,
      reseller.resellerId,
      "application_reviewed",
      "Application approved",
      "Your reseller application was approved. You can now access referral and commission tools."
    );
  }

  ensureTierConsistency(store, crmLeads);
  store.updatedAt = nowIso();
  await writeStore(store);

  return { application, reseller };
}

export async function listResellerProfiles(
  filters: ResellerProfileListFilters = {}
): Promise<ResellerProfileSummary[]> {
  const { store, crmLeads } = await loadStoreWithSync();
  const query = normalizeText(filters.query).toLowerCase();

  return store.resellers
    .filter((reseller) => {
      if (filters.status && reseller.status !== filters.status) {
        return false;
      }
      if (filters.region && reseller.region.toLowerCase() !== filters.region.toLowerCase()) {
        return false;
      }
      if (query) {
        const bag = [reseller.name, reseller.companyName, reseller.email, reseller.region]
          .join(" ")
          .toLowerCase();
        return bag.includes(query);
      }
      return true;
    })
    .map((reseller) => ({
      reseller,
      metrics: deriveMetrics(store, reseller.resellerId, crmLeads)
    }))
    .sort((left, right) => right.metrics.revenue - left.metrics.revenue);
}

export async function findResellerByReferralCode(referralCode: string) {
  const { store } = await loadStoreWithSync();
  const normalized = normalizeText(referralCode).toUpperCase();
  return store.resellers.find((item) => item.referralCode.toUpperCase() === normalized) ?? null;
}

export async function findResellerByIdOrEmail(input: {
  resellerId?: string;
  email?: string;
  referralCode?: string;
}) {
  const { store } = await loadStoreWithSync();

  const byId = input.resellerId
    ? store.resellers.find((item) => item.resellerId === input.resellerId)
    : null;
  if (byId) {
    return byId;
  }

  const byReferral = input.referralCode
    ? store.resellers.find(
        (item) => item.referralCode.toUpperCase() === normalizeText(input.referralCode).toUpperCase()
      )
    : null;
  if (byReferral) {
    return byReferral;
  }

  if (!input.email) {
    return null;
  }

  return (
    store.resellers.find((item) => normalizeEmail(item.email) === normalizeEmail(input.email)) ??
    null
  );
}

export async function assignLeadToReseller(input: AssignLeadInput) {
  const leadId = normalizeText(input.leadId);
  const resellerId = normalizeText(input.resellerId);
  const assignedBy = normalizeText(input.assignedBy) || "admin:channel_manager";
  const mode = isAssignmentMode(input.mode) ? input.mode : "manual";

  if (!leadId || !resellerId) {
    throw new Error("leadId and resellerId are required.");
  }

  const { store, crmLeads } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.resellerId === resellerId);

  if (!reseller) {
    throw new Error("Reseller not found.");
  }

  const lead = crmLeads.find((item) => item.leadId === leadId);
  if (!lead) {
    throw new Error("Lead not found.");
  }

  if (lead.email && normalizeEmail(lead.email) === normalizeEmail(reseller.email)) {
    addFraudFlag(store, {
      resellerId,
      leadId,
      code: "self_referral",
      detail: `Self-referral risk detected for lead ${leadId}.`
    });
  }

  const assignment: ResellerLeadAssignment = {
    assignmentId: makeId("assign"),
    leadId,
    resellerId,
    assignedAt: nowIso(),
    assignedBy,
    mode,
    regionBasis: normalizeText(input.regionBasis) || null,
    performanceBasis: normalizeText(input.performanceBasis) || null,
    overrideReason: normalizeText(input.overrideReason) || null
  };

  store.leadAssignments = [assignment, ...store.leadAssignments.filter((item) => item.leadId !== leadId)];

  try {
    await updateCrmLead(leadId, { resellerId, commissionEligible: true }, assignedBy);
  } catch {
    // CRM can be unavailable in fallback mode; assignment remains persisted locally.
  }

  addNotification(
    store,
    resellerId,
    "lead_assigned",
    "New lead assigned",
    `Lead ${lead.companyName} (${leadId}) assigned via ${mode}.`
  );

  store.updatedAt = nowIso();
  await writeStore(store);

  return assignment;
}

export async function listAssignableCrmLeads(filters?: {
  status?: string;
  query?: string;
  minScore?: number;
}) {
  const { store, crmLeads } = await loadStoreWithSync();
  const query = normalizeText(filters?.query).toLowerCase();
  const assignments = new Map(store.leadAssignments.map((item) => [item.leadId, item.resellerId]));

  return crmLeads
    .filter((lead) => {
      if (filters?.status && lead.status !== filters.status) {
        return false;
      }
      if (typeof filters?.minScore === "number" && lead.score < filters.minScore) {
        return false;
      }
      if (query) {
        const bag = [lead.name, lead.companyName, lead.email].join(" ").toLowerCase();
        if (!bag.includes(query)) {
          return false;
        }
      }
      return true;
    })
    .map<AssignableCrmLeadSummary>((lead) => ({
      leadId: lead.leadId,
      name: lead.name,
      email: lead.email,
      companyName: lead.companyName,
      status: lead.status,
      score: lead.score,
      source: lead.source,
      createdAt: lead.createdAt,
      assignedResellerId: assignments.get(lead.leadId) ?? lead.resellerId ?? null
    }))
    .sort((left, right) => right.score - left.score);
}

export async function trackResellerReferralEvent(input: TrackReferralInput) {
  const referralCode = normalizeText(input.referralCode).toUpperCase();
  if (!referralCode) {
    throw new Error("referralCode is required.");
  }

  const { store } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.referralCode.toUpperCase() === referralCode);

  if (!reseller) {
    throw new Error("Referral code is not recognized.");
  }

  const eventType = input.eventType;
  if (!["visit", "signup", "purchase"].includes(eventType)) {
    throw new Error("Invalid eventType.");
  }

  if (input.visitorEmail && normalizeEmail(input.visitorEmail) === normalizeEmail(reseller.email)) {
    addFraudFlag(store, {
      resellerId: reseller.resellerId,
      leadId: input.leadId ?? null,
      code: "self_referral",
      detail: `Self referral detected for code ${referralCode}.`
    });
  }

  if (eventType === "visit") {
    store.referralVisits.unshift({
      visitId: makeId("visit"),
      resellerId: reseller.resellerId,
      referralCode,
      path: normalizeText(input.path) || "/",
      source: normalizeText(input.source) || null,
      createdAt: nowIso()
    });
  } else {
    const conversion: ReferralConversionRecord = {
      conversionId: makeId("conv"),
      resellerId: reseller.resellerId,
      referralCode,
      conversionType: eventType,
      leadId: normalizeText(input.leadId) || null,
      customerId: normalizeText(input.customerId) || null,
      amount:
        typeof input.amount === "number" && Number.isFinite(input.amount)
          ? input.amount
          : null,
      createdAt: nowIso()
    };

    store.referralConversions.unshift(conversion);

    if (eventType === "purchase") {
      const amount =
        typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0
          ? input.amount
          : 3000;
      const rule = resolveCommissionRule(store);
      const commissionAmount = Number(
        commissionAmountFromRule(rule, amount, reseller.tier).toFixed(2)
      );

      store.commissions.unshift({
        commissionId: makeId("comm"),
        resellerId: reseller.resellerId,
        customerId:
          normalizeText(input.customerId) || normalizeText(input.leadId) || makeId("customer"),
        leadId: normalizeText(input.leadId) || null,
        amount: commissionAmount,
        status: "pending",
        triggerType: "new_subscription",
        ruleId: rule.ruleId,
        createdAt: nowIso(),
        approvedAt: null,
        paidAt: null
      });

      addNotification(
        store,
        reseller.resellerId,
        "commission_earned",
        "Commission earned",
        `Referral purchase created ${commissionAmount.toFixed(2)} TRY pending commission.`
      );
    }
  }

  store.updatedAt = nowIso();
  await writeStore(store);

  const visits = store.referralVisits.filter((item) => item.resellerId === reseller.resellerId).length;
  const signups = store.referralConversions.filter(
    (item) => item.resellerId === reseller.resellerId && item.conversionType === "signup"
  ).length;
  const purchases = store.referralConversions.filter(
    (item) => item.resellerId === reseller.resellerId && item.conversionType === "purchase"
  ).length;

  return {
    resellerId: reseller.resellerId,
    referralCode,
    visits,
    signups,
    purchases
  };
}

export async function createCommissionForReseller(input: CreateCommissionInput) {
  const resellerId = normalizeText(input.resellerId);
  const customerId = normalizeText(input.customerId);
  const triggerType = isTriggerType(input.triggerType)
    ? input.triggerType
    : "new_subscription";

  if (!resellerId || !customerId) {
    throw new Error("resellerId and customerId are required.");
  }

  const { store } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.resellerId === resellerId);
  if (!reseller) {
    throw new Error("Reseller not found.");
  }

  const rule = resolveCommissionRule(store);
  const baseAmount =
    typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0
      ? input.amount
      : 3000;

  const amount = Number(
    commissionAmountFromRule(rule, baseAmount, reseller.tier).toFixed(2)
  );

  const commission: ResellerCommissionRecord = {
    commissionId: makeId("comm"),
    resellerId,
    customerId,
    leadId: normalizeText(input.leadId) || null,
    amount,
    status: "pending",
    triggerType,
    ruleId: rule.ruleId,
    createdAt: nowIso(),
    approvedAt: null,
    paidAt: null
  };

  store.commissions.unshift(commission);
  addNotification(
    store,
    resellerId,
    "commission_earned",
    "Manual commission added",
    `A ${amount.toFixed(2)} TRY commission entry was added by admin.`
  );

  store.updatedAt = nowIso();
  await writeStore(store);

  return commission;
}

export async function updateCommissionStatus(
  commissionId: string,
  status: ResellerCommissionStatus
) {
  if (!isCommissionStatus(status)) {
    throw new Error("Invalid commission status.");
  }

  const { store } = await loadStoreWithSync();
  const commission = store.commissions.find((item) => item.commissionId === commissionId);
  if (!commission) {
    throw new Error("Commission not found.");
  }

  commission.status = status;
  if (status === "approved") {
    commission.approvedAt = nowIso();
  }
  if (status === "paid") {
    commission.paidAt = nowIso();
  }

  store.updatedAt = nowIso();
  await writeStore(store);

  return commission;
}

export async function createResellerPayout(input: CreatePayoutInput) {
  const resellerId = normalizeText(input.resellerId);
  if (!resellerId) {
    throw new Error("resellerId is required.");
  }

  const { store } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.resellerId === resellerId);
  if (!reseller) {
    throw new Error("Reseller not found.");
  }

  const targetCommissions =
    input.commissionIds && input.commissionIds.length > 0
      ? store.commissions.filter(
          (item) => input.commissionIds?.includes(item.commissionId) && item.resellerId === resellerId
        )
      : store.commissions.filter(
          (item) => item.resellerId === resellerId && item.status === "approved"
        );

  if (targetCommissions.length === 0) {
    throw new Error("No approved commissions found for payout.");
  }

  const amount = targetCommissions.reduce((sum, item) => sum + item.amount, 0);
  const payout: ResellerPayoutRecord = {
    payoutId: makeId("payout"),
    resellerId,
    amount,
    payoutDate: null,
    status: "pending",
    commissionIds: targetCommissions.map((item) => item.commissionId),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.payouts.unshift(payout);
  store.updatedAt = nowIso();
  await writeStore(store);

  return payout;
}

export async function updateResellerPayoutStatus(
  payoutId: string,
  status: ResellerPayoutStatus
) {
  if (!isPayoutStatus(status)) {
    throw new Error("Invalid payout status.");
  }

  const { store } = await loadStoreWithSync();
  const payout = store.payouts.find((item) => item.payoutId === payoutId);
  if (!payout) {
    throw new Error("Payout not found.");
  }

  payout.status = status;
  payout.updatedAt = nowIso();

  if (status === "paid") {
    payout.payoutDate = nowIso();
    for (const commissionId of payout.commissionIds) {
      const commission = store.commissions.find((item) => item.commissionId === commissionId);
      if (!commission) {
        continue;
      }

      commission.status = "paid";
      commission.paidAt = nowIso();
    }

    addNotification(
      store,
      payout.resellerId,
      "payout_processed",
      "Payout processed",
      `Payout ${payout.payoutId} marked as paid (${payout.amount.toFixed(2)} TRY).`
    );
  }

  store.updatedAt = nowIso();
  await writeStore(store);

  return payout;
}

export async function updateResellerProfile(
  resellerId: string,
  patch: UpdateProfileInput
) {
  const { store } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.resellerId === resellerId);
  if (!reseller) {
    throw new Error("Reseller not found.");
  }

  if (patch.status && isResellerStatus(patch.status)) {
    reseller.status = patch.status;
  }
  if (patch.region) {
    reseller.region = normalizeText(patch.region) || reseller.region;
  }
  if (
    typeof patch.commissionRate === "number" &&
    Number.isFinite(patch.commissionRate) &&
    patch.commissionRate > 0
  ) {
    reseller.commissionRate = patch.commissionRate;
  }
  if (patch.tier && resellerTiers.includes(patch.tier)) {
    reseller.tier = patch.tier;
  }

  reseller.updatedAt = nowIso();
  store.updatedAt = nowIso();
  await writeStore(store);

  return reseller;
}

export async function getResellerDetailWorkspace(
  resellerId: string
): Promise<ResellerDetailWorkspace | null> {
  const { store, crmLeads } = await loadStoreWithSync();
  const reseller = store.resellers.find((item) => item.resellerId === resellerId);
  if (!reseller) {
    return null;
  }

  const metrics = deriveMetrics(store, resellerId, crmLeads);
  const leads = ownedLeads(store, resellerId, crmLeads)
    .map((lead) => buildLeadSummary(lead))
    .sort((left, right) => right.score - left.score);

  return {
    reseller,
    metrics,
    assignedLeads: leads,
    assignments: store.leadAssignments
      .filter((item) => item.resellerId === resellerId)
      .sort((a, b) => asTimestamp(b.assignedAt) - asTimestamp(a.assignedAt)),
    referrals: {
      visits: store.referralVisits.filter((item) => item.resellerId === resellerId).length,
      signups: store.referralConversions.filter(
        (item) => item.resellerId === resellerId && item.conversionType === "signup"
      ).length,
      purchases: store.referralConversions.filter(
        (item) => item.resellerId === resellerId && item.conversionType === "purchase"
      ).length,
      recentVisits: store.referralVisits
        .filter((item) => item.resellerId === resellerId)
        .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
        .slice(0, 40),
      recentConversions: store.referralConversions
        .filter((item) => item.resellerId === resellerId)
        .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
        .slice(0, 40)
    },
    commissions: store.commissions
      .filter((item) => item.resellerId === resellerId)
      .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt)),
    payouts: store.payouts
      .filter((item) => item.resellerId === resellerId)
      .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt)),
    notifications: store.notifications
      .filter((item) => item.resellerId === resellerId)
      .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
      .slice(0, 100),
    fraudFlags: store.fraudFlags
      .filter((item) => item.resellerId === resellerId)
      .sort((a, b) => asTimestamp(b.createdAt) - asTimestamp(a.createdAt))
      .slice(0, 80),
    assets: [...resellerPartnerAssets],
    training: [...resellerTrainingModules]
  };
}

export async function getResellerWorkspaceByLookup(input: {
  resellerId?: string;
  email?: string;
  referralCode?: string;
}) {
  const target = await findResellerByIdOrEmail(input);
  if (!target) {
    return null;
  }

  return await getResellerDetailWorkspace(target.resellerId);
}

export async function getResellerGrowthDashboard(): Promise<ResellerGrowthDashboard> {
  const { store, crmLeads } = await loadStoreWithSync();

  const summaries = store.resellers.map((reseller) => ({
    reseller,
    metrics: deriveMetrics(store, reseller.resellerId, crmLeads)
  }));

  const totals = summaries.reduce(
    (acc, current) => {
      acc.leadsGenerated += current.metrics.leadsGenerated;
      acc.conversionCount += current.metrics.conversionCount;
      acc.revenue += current.metrics.revenue;
      return acc;
    },
    {
      leadsGenerated: 0,
      conversionCount: 0,
      revenue: 0
    }
  );

  const pendingPayout = store.commissions
    .filter((item) => item.status === "approved" || item.status === "pending")
    .reduce((sum, item) => sum + item.amount, 0);

  const conversionRate =
    totals.leadsGenerated > 0
      ? Number(((totals.conversionCount / totals.leadsGenerated) * 100).toFixed(2))
      : 0;

  const regionalMap = new Map<string, { resellers: number; leads: number; conversions: number }>();

  for (const item of summaries) {
    const regionKey = item.reseller.region || "Unknown";
    const current = regionalMap.get(regionKey) ?? {
      resellers: 0,
      leads: 0,
      conversions: 0
    };

    current.resellers += 1;
    current.leads += item.metrics.leadsGenerated;
    current.conversions += item.metrics.conversionCount;
    regionalMap.set(regionKey, current);
  }

  return {
    totals: {
      totalResellers: store.resellers.length,
      activeResellers: store.resellers.filter((item) => item.status === "active").length,
      pendingApplications: store.applications.filter(
        (item) => item.status === "submitted" || item.status === "under_review"
      ).length,
      leadsGenerated: totals.leadsGenerated,
      conversionCount: totals.conversionCount,
      conversionRate,
      revenue: totals.revenue,
      pendingPayout
    },
    topResellers: summaries
      .map((item) => ({
        resellerId: item.reseller.resellerId,
        companyName: item.reseller.companyName,
        tier: item.reseller.tier,
        conversionRate: item.metrics.conversionRate,
        revenue: item.metrics.revenue,
        leadsGenerated: item.metrics.leadsGenerated
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 10),
    regionalDistribution: Array.from(regionalMap.entries()).map(([region, stats]) => ({
      region,
      resellers: stats.resellers,
      leads: stats.leads,
      conversions: stats.conversions
    }))
  };
}

export async function getResellerGrowthSnapshot() {
  const { store } = await loadStoreWithSync();
  return store;
}
