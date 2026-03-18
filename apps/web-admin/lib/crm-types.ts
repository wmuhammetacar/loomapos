export const crmLeadStatuses = [
  "new",
  "contacted",
  "qualified",
  "demo_scheduled",
  "proposal_sent",
  "converted",
  "lost"
] as const;

export type CrmLeadStatus = (typeof crmLeadStatuses)[number];

export const crmLeadSources = [
  "contact_form",
  "demo_request",
  "pricing_cta",
  "download_attempt",
  "reseller_application",
  "newsletter_signup",
  "checkout_start",
  "manual_import"
] as const;

export type CrmLeadSource = (typeof crmLeadSources)[number];

export const crmSalesRoles = ["sales_rep", "sales_manager"] as const;
export type CrmSalesRole = (typeof crmSalesRoles)[number];

export const crmDemoStatuses = ["scheduled", "completed", "no_show"] as const;
export type CrmDemoStatus = (typeof crmDemoStatuses)[number];

export const crmActivityTypes = [
  "lead_created",
  "website_visit",
  "pricing_page_visit",
  "demo_requested",
  "download_attempt",
  "signup_started",
  "onboarding_completed",
  "email_opened",
  "call_logged",
  "note_added",
  "status_changed",
  "proposal_sent",
  "checkout_abandoned",
  "checkout_completed",
  "reseller_assigned",
  "manual_update"
] as const;

export type CrmActivityType = (typeof crmActivityTypes)[number];

export interface CrmLead {
  leadId: string;
  name: string;
  email: string;
  phone?: string;
  companyName: string;
  source: CrmLeadSource;
  status: CrmLeadStatus;
  score: number;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string | null;
  tenantId?: string | null;
  conversionDate?: string | null;
  resellerId?: string | null;
  commissionEligible?: boolean;
  trialEndsAt?: string | null;
  lostReason?: string | null;
}

export interface CrmSalesUser {
  userId: string;
  name: string;
  email: string;
  role: CrmSalesRole;
  active: boolean;
  createdAt: string;
}

export interface CrmLeadActivity {
  activityId: string;
  leadId: string;
  type: CrmActivityType;
  title: string;
  detail?: string;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, string>;
}

export interface CrmLeadNote {
  noteId: string;
  leadId: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface CrmDemoSchedule {
  demoId: string;
  leadId: string;
  date: string;
  time: string;
  assignedSalesRep: string;
  meetingLink?: string;
  status: CrmDemoStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CrmNotification {
  notificationId: string;
  type: "new_lead" | "high_score" | "demo_requested" | "lead_inactive";
  leadId?: string;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
}

export interface CrmEmailAutomationEvent {
  emailId: string;
  leadId: string;
  templateCode: "welcome" | "demo_confirmation" | "follow_up" | "trial_expiring";
  subject: string;
  status: "queued" | "sent";
  triggerReason: string;
  createdAt: string;
}

export interface CrmAuditLog {
  logId: string;
  leadId: string;
  action: string;
  actor: string;
  createdAt: string;
  payload: Record<string, string>;
}

export interface CrmDashboardMetrics {
  totalLeads: number;
  newLeadsToday: number;
  conversionRate: number;
  pipelineDistribution: Record<CrmLeadStatus, number>;
  topSalesReps: Array<{ userId: string; name: string; assigned: number; converted: number }>;
  sourcePerformance: Array<{ source: CrmLeadSource; leads: number; converted: number }>;
  highScoreLeads: number;
  abandonedCheckoutLeads: number;
}

export interface CrmLeadFilters {
  status?: CrmLeadStatus;
  source?: CrmLeadSource;
  assignedTo?: string;
  minScore?: number;
  maxScore?: number;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CrmLeadListResponse {
  leads: CrmLead[];
  metrics: CrmDashboardMetrics;
  salesUsers: CrmSalesUser[];
  notifications: CrmNotification[];
}

export interface CrmLeadDetailResponse {
  lead: CrmLead;
  activities: CrmLeadActivity[];
  notes: CrmLeadNote[];
  demos: CrmDemoSchedule[];
  audit: CrmAuditLog[];
}

export interface CrmDashboardResponse {
  metrics: CrmDashboardMetrics;
  emailAutomations: CrmEmailAutomationEvent[];
  notifications: CrmNotification[];
  salesUsers: CrmSalesUser[];
}

export const crmScoreRules: Record<string, number> = {
  pricing_page_visit: 10,
  demo_requested: 20,
  download_attempt: 15,
  signup_started: 30,
  onboarding_completed: 50
};
