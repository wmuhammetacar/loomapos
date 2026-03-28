export type PlanCode = "starter" | "growth" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export interface PlanLimits {
  maxBranches: number;
  maxDevices: number;
  maxStaff: number;
  features: string[];
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
}

interface PlanDefinition {
  rank: number;
  limits: PlanLimits;
  pricing: PlanPricing;
}

export const TRIAL_DAYS = 14;

export const TRIAL_LIMITS: PlanLimits = {
  maxBranches: 1,
  maxDevices: 2,
  maxStaff: 5,
  features: ["sales_basic", "inventory_basic", "reports_basic"]
};

const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  starter: {
    rank: 1,
    limits: {
      maxBranches: 1,
      maxDevices: 2,
      maxStaff: 5,
      features: ["sales_basic", "inventory_basic", "reports_basic", "e_invoice_limited"]
    },
    pricing: {
      monthly: 49900,
      yearly: 479000
    }
  },
  growth: {
    rank: 2,
    limits: {
      maxBranches: 4,
      maxDevices: 8,
      maxStaff: 25,
      features: [
        "sales_advanced",
        "inventory_advanced",
        "reports_advanced",
        "e_invoice",
        "online_collection"
      ]
    },
    pricing: {
      monthly: 119900,
      yearly: 1151000
    }
  },
  enterprise: {
    rank: 3,
    limits: {
      maxBranches: 100,
      maxDevices: 500,
      maxStaff: 2000,
      features: [
        "sales_enterprise",
        "inventory_enterprise",
        "reports_enterprise",
        "e_invoice",
        "online_collection",
        "priority_support",
        "advanced_audit"
      ]
    },
    pricing: {
      monthly: 0,
      yearly: 0
    }
  }
};

export function getPlanLimits(planCode: string): PlanLimits {
  const key = (planCode || "starter") as PlanCode;
  return PLAN_DEFINITIONS[key]?.limits ?? PLAN_DEFINITIONS.starter.limits;
}

export function getPlanPrice(planCode: string, cycle: BillingCycle): number {
  const key = (planCode || "starter") as PlanCode;
  const definition = PLAN_DEFINITIONS[key] ?? PLAN_DEFINITIONS.starter;
  return definition.pricing[cycle];
}

export function getPlanRank(planCode: string): number {
  const key = (planCode || "starter") as PlanCode;
  return PLAN_DEFINITIONS[key]?.rank ?? PLAN_DEFINITIONS.starter.rank;
}

export function isUpgrade(fromPlan: string, toPlan: string) {
  return getPlanRank(toPlan) > getPlanRank(fromPlan);
}

export function isDowngrade(fromPlan: string, toPlan: string) {
  return getPlanRank(toPlan) < getPlanRank(fromPlan);
}

export function getTrialEndDate(from = new Date()) {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

export function getSubscriptionEndDate(start: Date, cycle: BillingCycle) {
  const end = new Date(start);
  if (cycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}
