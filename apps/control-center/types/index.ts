export type TenantPlan = "starter" | "growth" | "enterprise";

export type TenantStatus = "active" | "trial" | "suspended";
export type TenantLifecycleState =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_canceled"
  | "suspended_blocked";

export type DeviceStatus = "active" | "stale" | "offline" | "blocked";

export type DataConnectionStatus = "connected" | "partial" | "not_connected";

export interface ActivityItem {
  id: string;
  time: string;
  action: string;
  actor: string;
  target: string;
}

export interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  trialExpiringSoonTenants: number;
  trialExpiredReadOnlyTenants: number;
  suspendedBlockedTenants: number;
  devicesOnline: number;
  devicesOffline: number;
  syncIssues: number;
  recentActivity: ActivityItem[];
}

export interface TenantSummary {
  id: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  lifecycleState: TenantLifecycleState;
  devices: number;
  lastActivity: string;
  subscriptionStatus: string;
  billingCycle: string;
  deviceLimit: number;
}

export interface TenantDetail extends TenantSummary {
  tenantCode: string;
  ownerEmail: string;
  phone: string;
  licenseStatus: string;
  resellerCode?: string | null;
  supportNotes: string[];
  recentActivity: ActivityItem[];
  featureFlags: string[];
  recentNotices: string[];
  appVersions: string[];
  latestInvoiceNo: string;
  onboardingState: string;
  supportSummary: string;
  supportConnection: DataConnectionStatus;
  auditConnection: DataConnectionStatus;
  syncConnection: DataConnectionStatus;
  syncSummary: string;
}

export interface DeviceRow {
  deviceId: string;
  tenantId: string;
  tenantName: string;
  branchId: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  appVersion: string | null;
  licenseStatus: string;
  isOnline: boolean;
  isStale: boolean;
}

export interface SubscriptionRow {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: TenantPlan;
  billingCycle: string;
  renewalDate: string | null;
  status: string;
  tenantStatus: TenantStatus;
  lifecycleState: TenantLifecycleState;
}

export type SyncIssueStatus = "retrying" | "failed" | "dead_letter";

export interface SyncIssue {
  issueId: string;
  tenantId: string;
  tenantName: string;
  deviceId: string | null;
  eventId: string;
  eventType: string;
  status: SyncIssueStatus;
  retryCount: number;
  reason: string;
  createdAt: string;
  lastAttemptAt: string | null;
  isPermanentFailure: boolean;
  isRetryable: boolean;
}

export interface SupportCaseRow {
  caseId: string;
  tenantId: string | null;
  tenantName: string;
  priority: string;
  status: string;
  subject: string;
  summary: string;
  assignee: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  time: string;
  action: string;
  actor: string;
  target: string;
}

export interface ConnectedList<T> {
  connection: DataConnectionStatus;
  message?: string;
  items: T[];
}
