export const resellerApplicationStatuses = [
  "submitted",
  "under_review",
  "approved",
  "rejected"
] as const;

export type ResellerApplicationStatus = (typeof resellerApplicationStatuses)[number];

export const resellerStatuses = ["pending", "active", "suspended"] as const;
export type ResellerStatus = (typeof resellerStatuses)[number];

export const resellerCommissionStatuses = ["pending", "approved", "paid"] as const;
export type ResellerCommissionStatus = (typeof resellerCommissionStatuses)[number];

export const resellerPayoutStatuses = ["pending", "processing", "paid", "failed"] as const;
export type ResellerPayoutStatus = (typeof resellerPayoutStatuses)[number];

export const resellerLeadAssignmentModes = [
  "auto_region",
  "auto_performance",
  "manual"
] as const;
export type ResellerLeadAssignmentMode = (typeof resellerLeadAssignmentModes)[number];

export const resellerCommissionTriggerTypes = [
  "new_subscription",
  "renewal",
  "upgrade"
] as const;
export type ResellerCommissionTriggerType = (typeof resellerCommissionTriggerTypes)[number];

export const resellerCommissionRuleKinds = ["percent", "fixed", "tiered"] as const;
export type ResellerCommissionRuleKind = (typeof resellerCommissionRuleKinds)[number];

export const resellerTiers = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type ResellerTier = (typeof resellerTiers)[number];

export const resellerNotificationTypes = [
  "application_reviewed",
  "lead_assigned",
  "lead_converted",
  "commission_earned",
  "payout_processed",
  "fraud_flag"
] as const;
export type ResellerNotificationType = (typeof resellerNotificationTypes)[number];

export interface ResellerApplicationInput {
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  businessType: string;
  experience?: string;
  region: string;
}

export interface ResellerApplicationRecord extends ResellerApplicationInput {
  applicationId: string;
  status: ResellerApplicationStatus;
  submittedAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  resellerId?: string | null;
}

export interface ResellerProfile {
  resellerId: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  status: ResellerStatus;
  region: string;
  commissionRate: number;
  referralCode: string;
  tier: ResellerTier;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerLeadAssignment {
  assignmentId: string;
  leadId: string;
  resellerId: string;
  assignedAt: string;
  assignedBy: string;
  mode: ResellerLeadAssignmentMode;
  regionBasis?: string | null;
  performanceBasis?: string | null;
  overrideReason?: string | null;
}

export interface ReferralVisitRecord {
  visitId: string;
  resellerId: string;
  referralCode: string;
  path: string;
  source?: string | null;
  createdAt: string;
}

export interface ReferralConversionRecord {
  conversionId: string;
  resellerId: string;
  referralCode: string;
  conversionType: "signup" | "purchase";
  leadId?: string | null;
  customerId?: string | null;
  amount?: number | null;
  createdAt: string;
}

export interface ResellerCommissionRule {
  ruleId: string;
  name: string;
  kind: ResellerCommissionRuleKind;
  value: number;
  tierThresholds?: Array<{ tier: ResellerTier; value: number }>;
  active: boolean;
}

export interface ResellerCommissionRecord {
  commissionId: string;
  resellerId: string;
  customerId: string;
  leadId?: string | null;
  amount: number;
  status: ResellerCommissionStatus;
  triggerType: ResellerCommissionTriggerType;
  ruleId: string;
  createdAt: string;
  approvedAt?: string | null;
  paidAt?: string | null;
}

export interface ResellerPayoutRecord {
  payoutId: string;
  resellerId: string;
  amount: number;
  payoutDate?: string | null;
  status: ResellerPayoutStatus;
  commissionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResellerFraudFlag {
  flagId: string;
  resellerId?: string | null;
  leadId?: string | null;
  code: "fake_signup" | "self_referral" | "duplicate_account";
  detail: string;
  resolved: boolean;
  createdAt: string;
}

export interface ResellerNotificationRecord {
  notificationId: string;
  resellerId: string;
  type: ResellerNotificationType;
  title: string;
  detail: string;
  createdAt: string;
  read: boolean;
}

export interface ResellerPerformanceMetrics {
  leadsGenerated: number;
  conversionCount: number;
  conversionRate: number;
  revenue: number;
  churnRate: number;
  activeCustomers: number;
  pendingCommission: number;
  paidCommission: number;
}

export interface ResellerLeadSummary {
  leadId: string;
  name: string;
  companyName: string;
  email: string;
  status: string;
  score: number;
  createdAt: string;
  convertedAt?: string | null;
}

export interface ResellerGrowthDashboard {
  totals: {
    totalResellers: number;
    activeResellers: number;
    pendingApplications: number;
    leadsGenerated: number;
    conversionCount: number;
    conversionRate: number;
    revenue: number;
    pendingPayout: number;
  };
  topResellers: Array<{
    resellerId: string;
    companyName: string;
    tier: ResellerTier;
    conversionRate: number;
    revenue: number;
    leadsGenerated: number;
  }>;
  regionalDistribution: Array<{ region: string; resellers: number; leads: number; conversions: number }>;
}

export interface ResellerDetailWorkspace {
  reseller: ResellerProfile;
  metrics: ResellerPerformanceMetrics;
  assignedLeads: ResellerLeadSummary[];
  assignments: ResellerLeadAssignment[];
  referrals: {
    visits: number;
    signups: number;
    purchases: number;
    recentVisits: ReferralVisitRecord[];
    recentConversions: ReferralConversionRecord[];
  };
  commissions: ResellerCommissionRecord[];
  payouts: ResellerPayoutRecord[];
  notifications: ResellerNotificationRecord[];
  fraudFlags: ResellerFraudFlag[];
  assets: Array<{ id: string; title: string; href: string; type: string }>;
  training: Array<{ id: string; title: string; level: string; href: string }>;
}

export interface ResellerGrowthStoreSnapshot {
  applications: ResellerApplicationRecord[];
  resellers: ResellerProfile[];
  leadAssignments: ResellerLeadAssignment[];
  referralVisits: ReferralVisitRecord[];
  referralConversions: ReferralConversionRecord[];
  commissionRules: ResellerCommissionRule[];
  commissions: ResellerCommissionRecord[];
  payouts: ResellerPayoutRecord[];
  notifications: ResellerNotificationRecord[];
  fraudFlags: ResellerFraudFlag[];
  updatedAt: string;
}
