"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { CustomerPortalExperience, PortalOnboardingStep } from "@/lib/portal-service";

type OnboardingStepCode =
  | "company_profile"
  | "desktop_download"
  | "license_activation"
  | "device_registration"
  | "first_branch"
  | "first_product"
  | "first_staff"
  | "first_sale";

type OnboardingEventType = "resume" | "step_completed" | "step_reopened";

interface OnboardingEventRecord {
  id: string;
  type: OnboardingEventType;
  stepCode?: OnboardingStepCode;
  createdAt: string;
}

interface OnboardingLocalState {
  completedAt: Partial<Record<OnboardingStepCode, string>>;
  events: OnboardingEventRecord[];
}

interface OnboardingChecklistItem {
  code: OnboardingStepCode;
  label: string;
  description: string;
  detail: string;
  href: string;
  hrefLabel: string;
  status: "complete" | "pending" | "attention";
  completedAt?: string | null;
  allowManualConfirm: boolean;
  locallyConfirmed: boolean;
}

interface OnboardingEmailPlanItem {
  id: string;
  subject: string;
  description: string;
  href: string;
  status: "sent" | "scheduled" | "pending" | "urgent";
}

const ONBOARDING_STEPS: ReadonlyArray<{
  code: OnboardingStepCode;
  label: string;
  description: string;
  detail: string;
  href: string;
  hrefLabel: string;
}> = [
  {
    code: "company_profile",
    label: "Complete company profile",
    description: "Fill company identity, tax placeholders, contact and locale details.",
    detail:
      "Expected fields: company name, tax placeholders, address, phone, business type placeholder, default currency and timezone.",
    href: "/portal/company",
    hrefLabel: "Open company profile"
  },
  {
    code: "desktop_download",
    label: "Download Desktop POS",
    description: "Download Windows installer and follow first-launch guidance.",
    detail:
      "Include system requirements, installation guidance and first launch instructions. Operational workflows remain in Desktop/Mobile apps.",
    href: "/portal/downloads",
    hrefLabel: "Open downloads"
  },
  {
    code: "license_activation",
    label: "Activate license",
    description: "Verify license and tenant association before store setup.",
    detail:
      "Portal must display active license, limits and allowed device count for the tenant.",
    href: "/portal/licenses",
    hrefLabel: "Open licenses"
  },
  {
    code: "device_registration",
    label: "Register first device",
    description: "Launch Desktop app, sign in and activate at least one device.",
    detail:
      "Activation captures device name, branch association and device ID metadata.",
    href: "/portal/devices",
    hrefLabel: "Open devices"
  },
  {
    code: "first_branch",
    label: "Create first branch",
    description: "Create your first branch from operational apps.",
    detail:
      "Expected branch fields: branch name, address, contact phone, manager placeholder and timezone.",
    href: "/docs/desktop-guide",
    hrefLabel: "Open branch guide"
  },
  {
    code: "first_product",
    label: "Add first product",
    description: "Create a product manually or import from spreadsheet.",
    detail:
      "Expected product fields: name, barcode, price, category and stock quantity. Import template is provided below.",
    href: "/docs/installation",
    hrefLabel: "Open product setup guide"
  },
  {
    code: "first_staff",
    label: "Create first staff member",
    description: "Define at least one operational user role in apps.",
    detail:
      "Expected fields: staff name, login/email, role (cashier/manager/admin) and branch access.",
    href: "/docs/mobile-guide",
    hrefLabel: "Open staff guide"
  },
  {
    code: "first_sale",
    label: "Complete first test sale",
    description: "Perform one successful test sale in Desktop POS.",
    detail:
      "Open app, select product, add to cart, choose payment method and complete transaction. Portal only tracks completion.",
    href: "/docs/getting-started",
    hrefLabel: "Open first-sale guide"
  }
];

const STEP_SIGNAL_CODES: Record<OnboardingStepCode, string[]> = {
  company_profile: ["company_profile"],
  desktop_download: ["apps_downloaded", "desktop_download"],
  license_activation: ["license_issued", "license_activation"],
  device_registration: ["devices_activated", "device_registration"],
  first_branch: ["first_branch", "branch_created"],
  first_product: ["first_product", "product_created"],
  first_staff: ["first_staff", "team_access", "staff_created"],
  first_sale: ["first_sale", "first_test_sale"]
};

const MANUAL_CONFIRM_CODES = new Set<OnboardingStepCode>([
  "desktop_download",
  "first_branch",
  "first_product",
  "first_staff",
  "first_sale"
]);

const STORAGE_KEY_PREFIX = "loomapos_onboarding_activation_state";

const EMPTY_STATE: OnboardingLocalState = {
  completedAt: {},
  events: []
};

function makeEventId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

function resolveStorageKey(snapshot: CustomerPortalExperience) {
  const tenantRef =
    snapshot.customer?.id ??
    snapshot.subscription?.tenantId ??
    snapshot.customer?.billingEmail ??
    "customer";
  return `${STORAGE_KEY_PREFIX}:${tenantRef}`;
}

function readLocalState(key: string): OnboardingLocalState {
  if (typeof window === "undefined") {
    return EMPTY_STATE;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return EMPTY_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as OnboardingLocalState;
    if (!parsed || typeof parsed !== "object") {
      return EMPTY_STATE;
    }
    return {
      completedAt: parsed.completedAt ?? {},
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, 200) : []
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeLocalState(key: string, state: OnboardingLocalState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(state));
}

function dispatchOnboardingEvent(
  snapshot: CustomerPortalExperience,
  event: OnboardingEventRecord,
  completionRate: number
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify({
    id: event.id,
    type: event.type,
    stepCode: event.stepCode,
    createdAt: event.createdAt,
    completionRate,
    portal: "customer",
    tenantId: snapshot.customer?.id ?? snapshot.subscription?.tenantId ?? null
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/onboarding/events", blob);
    return;
  }

  void fetch("/api/onboarding/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}

function toRemoteStepMap(steps: PortalOnboardingStep[]) {
  const map = new Map<string, PortalOnboardingStep>();
  for (const step of steps) {
    map.set(step.code.toLowerCase(), step);
  }
  return map;
}

function hasSignal(
  map: Map<string, PortalOnboardingStep>,
  code: OnboardingStepCode,
  status: "complete" | "pending" | "attention"
) {
  const aliases = STEP_SIGNAL_CODES[code];
  return aliases.some((alias) => map.get(alias)?.status === status);
}

function getCompletedAtFromSignals(
  snapshot: CustomerPortalExperience,
  localCompletedAt: string | undefined,
  remoteSteps: Map<string, PortalOnboardingStep>,
  code: OnboardingStepCode
) {
  if (localCompletedAt) {
    return localCompletedAt;
  }

  const aliases = STEP_SIGNAL_CODES[code];
  for (const alias of aliases) {
    const candidate = remoteSteps.get(alias)?.completedAt;
    if (candidate) {
      return candidate;
    }
  }

  if (code === "license_activation") {
    return snapshot.license?.issuedAt ?? null;
  }
  if (code === "device_registration") {
    const active = snapshot.devices.find((item) => !item.revokedAt && item.status.toLowerCase() !== "revoked");
    return active?.activatedAt ?? null;
  }
  if (code === "first_staff") {
    const firstAdditionalUser = snapshot.users.find((item) => !item.isOwner);
    return firstAdditionalUser?.createdAt ?? null;
  }

  return null;
}

function buildChecklist(
  snapshot: CustomerPortalExperience,
  localState: OnboardingLocalState
): OnboardingChecklistItem[] {
  const remote = toRemoteStepMap(snapshot.onboarding);
  const activeDevices = snapshot.devices.filter((item) => !item.revokedAt && item.status.toLowerCase() !== "revoked").length;
  const activePortalUsers = snapshot.users.filter((item) => item.status.toLowerCase() === "active").length;

  return ONBOARDING_STEPS.map((step) => {
    const locallyConfirmed = Boolean(localState.completedAt[step.code]);
    const remoteComplete = hasSignal(remote, step.code, "complete");
    const remoteAttention = hasSignal(remote, step.code, "attention");
    let automaticComplete = false;
    let attention = remoteAttention;

    switch (step.code) {
      case "company_profile":
        automaticComplete = Boolean(
          snapshot.customer?.companyName?.trim() &&
            snapshot.customer?.billingEmail?.trim() &&
            snapshot.customer?.country?.trim() &&
            snapshot.customer?.locale?.trim()
        );
        break;
      case "desktop_download":
        automaticComplete = remoteComplete;
        break;
      case "license_activation":
        automaticComplete = snapshot.license?.status.toLowerCase() === "active" || remoteComplete;
        attention = attention || Boolean(snapshot.license && snapshot.license.status.toLowerCase() !== "active");
        break;
      case "device_registration":
        automaticComplete = activeDevices > 0 || remoteComplete;
        attention = attention || snapshot.usage.overLimit.devices;
        break;
      case "first_branch":
        automaticComplete = remoteComplete;
        break;
      case "first_product":
        automaticComplete = remoteComplete;
        break;
      case "first_staff":
        automaticComplete = activePortalUsers > 1 || remoteComplete;
        break;
      case "first_sale":
        automaticComplete = remoteComplete;
        if (
          snapshot.promo.conversionState === "trialing" &&
          (snapshot.promo.trialRemainingDays ?? 999) <= 3
        ) {
          attention = true;
        }
        break;
      default:
        automaticComplete = remoteComplete;
        break;
    }

    const completed = locallyConfirmed || automaticComplete;
    const status: OnboardingChecklistItem["status"] = completed
      ? "complete"
      : attention
        ? "attention"
        : "pending";

    return {
      ...step,
      status,
      completedAt: completed
        ? getCompletedAtFromSignals(snapshot, localState.completedAt[step.code], remote, step.code)
        : null,
      allowManualConfirm: MANUAL_CONFIRM_CODES.has(step.code),
      locallyConfirmed
    };
  });
}

function buildEmailPlan(
  checklist: OnboardingChecklistItem[],
  snapshot: CustomerPortalExperience
): OnboardingEmailPlanItem[] {
  const completedCodes = new Set(
    checklist.filter((item) => item.status === "complete").map((item) => item.code)
  );
  const firstSaleDone = completedCodes.has("first_sale");
  const trialCritical =
    snapshot.promo.conversionState === "trialing" &&
    (snapshot.promo.trialRemainingDays ?? 999) <= 3 &&
    !firstSaleDone;

  return [
    {
      id: "welcome",
      subject: "Welcome to LoomaPOS",
      description: "Sent after purchase or trial activation with onboarding dashboard link.",
      href: "/portal/onboarding",
      status: "sent"
    },
    {
      id: "install-pos",
      subject: "Install Desktop POS",
      description: "Triggered when profile step starts. Includes download and system requirements.",
      href: "/portal/downloads",
      status: completedCodes.has("company_profile") ? "sent" : "scheduled"
    },
    {
      id: "first-product",
      subject: "Add your first product",
      description: "Triggered after device activation to guide catalog setup and import options.",
      href: "/docs/installation",
      status: completedCodes.has("device_registration") ? "sent" : "pending"
    },
    {
      id: "first-sale",
      subject: "Complete your first sale",
      description: "Triggered after first product step to drive initial transaction completion.",
      href: "/docs/getting-started",
      status: firstSaleDone
        ? "sent"
        : completedCodes.has("first_product")
          ? trialCritical
            ? "urgent"
            : "scheduled"
          : "pending"
    }
  ];
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function statusClassName(status: OnboardingChecklistItem["status"]) {
  if (status === "complete") {
    return "rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-success";
  }
  if (status === "attention") {
    return "rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900";
  }
  return "rounded-full border border-line bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-text/70";
}

function emailStatusClassName(status: OnboardingEmailPlanItem["status"]) {
  if (status === "sent") {
    return "rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-success";
  }
  if (status === "urgent") {
    return "rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-danger";
  }
  if (status === "scheduled") {
    return "rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand";
  }
  return "rounded-full border border-line bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-text/70";
}

export function OnboardingActivationDashboard({
  snapshot
}: {
  snapshot: CustomerPortalExperience;
}) {
  const storageKey = useMemo(() => resolveStorageKey(snapshot), [snapshot]);
  const [localState, setLocalState] = useState<OnboardingLocalState>(EMPTY_STATE);

  useEffect(() => {
    const state = readLocalState(storageKey);
    const latestEvent = state.events[0];
    const now = Date.now();
    const shouldAppendResume =
      !latestEvent ||
      latestEvent.type !== "resume" ||
      now - new Date(latestEvent.createdAt).getTime() > 10 * 60 * 1000;

    if (!shouldAppendResume) {
      setLocalState(state);
      return;
    }

    const resumeEvent: OnboardingEventRecord = {
      id: makeEventId("onb"),
      type: "resume",
      createdAt: new Date().toISOString()
    };
    const nextState: OnboardingLocalState = {
      completedAt: state.completedAt,
      events: [resumeEvent, ...state.events].slice(0, 200)
    };
    writeLocalState(storageKey, nextState);
    setLocalState(nextState);
  }, [storageKey]);

  const checklist = useMemo(() => buildChecklist(snapshot, localState), [snapshot, localState]);
  const completedCount = checklist.filter((item) => item.status === "complete").length;
  const totalCount = checklist.length;
  const pendingCount = totalCount - completedCount;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const firstSaleStep = checklist.find((item) => item.code === "first_sale");
  const emailPlan = useMemo(() => buildEmailPlan(checklist, snapshot), [checklist, snapshot]);
  const stepCompletionEvents = localState.events.filter((item) => item.type === "step_completed").length;

  function toggleManualStep(step: OnboardingChecklistItem) {
    if (!step.allowManualConfirm) {
      return;
    }

    const now = new Date().toISOString();
    const currentCompletedAt = localState.completedAt[step.code];
    const nextCompletedAt = { ...localState.completedAt };
    let nextEvent: OnboardingEventRecord;

    if (currentCompletedAt) {
      delete nextCompletedAt[step.code];
      nextEvent = {
        id: makeEventId("onb"),
        type: "step_reopened",
        stepCode: step.code,
        createdAt: now
      };
    } else {
      nextCompletedAt[step.code] = now;
      nextEvent = {
        id: makeEventId("onb"),
        type: "step_completed",
        stepCode: step.code,
        createdAt: now
      };
    }

    const nextState: OnboardingLocalState = {
      completedAt: nextCompletedAt,
      events: [nextEvent, ...localState.events].slice(0, 200)
    };
    writeLocalState(storageKey, nextState);
    setLocalState(nextState);

    const nextCompletedCount = buildChecklist(snapshot, nextState).filter(
      (item) => item.status === "complete"
    ).length;
    const nextRate = totalCount > 0 ? Math.round((nextCompletedCount / totalCount) * 100) : 0;
    dispatchOnboardingEvent(snapshot, nextEvent, nextRate);
  }

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          Activation dashboard
        </p>
        <CardTitle className="mt-2">Customer onboarding progress</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          This dashboard guides installation, activation and setup readiness. All operational POS workflows
          stay inside Desktop and Mobile apps.
        </p>
        <div className="mt-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/70">
            {completionRate}% completed
          </p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-pill bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionRate}
          >
            <div
              className="h-full rounded-pill bg-brand transition-all duration-260"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Completed steps" value={`${completedCount}/${totalCount}`} />
          <Metric label="Pending steps" value={String(pendingCount)} />
          <Metric label="Local completion events" value={String(stepCompletionEvents)} />
          <Metric
            label="First sale"
            value={firstSaleStep?.status === "complete" ? "Recorded" : "Pending"}
          />
        </div>
      </Card>

      {snapshot.promo.conversionState === "trialing" ? (
        <Card className="border-brand/30 bg-brand/5">
          <CardTitle>Trial onboarding reminder</CardTitle>
          <p className="mt-3 text-sm leading-6 text-text/72">
            Trial remaining days:{" "}
            <span className="font-semibold text-text">
              {snapshot.promo.trialRemainingDays ?? "-"}
            </span>
            . Complete onboarding and first sale before trial expiry.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/portal/subscription"
              className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              Review trial and upgrade options
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80"
            >
              Compare plans
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {checklist.map((step) => (
          <Card key={step.code}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={statusClassName(step.status)}>{step.status}</span>
              <span className="text-xs uppercase tracking-[0.2em] text-text/55">{step.code}</span>
            </div>
            <CardTitle className="mt-3">{step.label}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-text/72">{step.description}</p>
            <p className="mt-2 text-sm leading-6 text-text/65">{step.detail}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-text/50">
              Completed at: {formatDate(step.completedAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={step.href as never}
                className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/85"
              >
                {step.hrefLabel}
              </Link>
              {step.allowManualConfirm ? (
                <Button
                  size="sm"
                  variant={step.locallyConfirmed ? "outline" : "primary"}
                  onClick={() => toggleManualStep(step)}
                >
                  {step.locallyConfirmed ? "Mark as pending" : "Confirm completed in app"}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>First sale simulation checklist</CardTitle>
        <ol className="mt-4 space-y-2 text-sm leading-6 text-text/72">
          <li>1. Open Desktop POS and sign in with activated tenant credentials.</li>
          <li>2. Scan or select a product.</li>
          <li>3. Add item to cart and verify totals.</li>
          <li>4. Select payment method and finalize transaction.</li>
          <li>5. Return here and confirm first sale completion.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/portal/downloads"
            className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80"
          >
            Open desktop download
          </Link>
          <Button
            size="sm"
            variant={
              checklist.find((item) => item.code === "first_sale")?.locallyConfirmed
                ? "outline"
                : "primary"
            }
            onClick={() => {
              const saleStep = checklist.find((item) => item.code === "first_sale");
              if (!saleStep) {
                return;
              }
              toggleManualStep(saleStep);
            }}
          >
            {checklist.find((item) => item.code === "first_sale")?.locallyConfirmed
              ? "Reopen first sale step"
              : "Confirm first sale recorded"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Onboarding analytics signals</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Profile setup"
            value={
              checklist.find((item) => item.code === "company_profile")?.status === "complete"
                ? "Done"
                : "Pending"
            }
          />
          <Metric
            label="Desktop installation"
            value={
              checklist.find((item) => item.code === "desktop_download")?.status === "complete"
                ? "Done"
                : "Pending"
            }
          />
          <Metric label="Device activations" value={String(snapshot.devices.length)} />
          <Metric
            label="First product"
            value={
              checklist.find((item) => item.code === "first_product")?.status === "complete"
                ? "Done"
                : "Pending"
            }
          />
          <Metric
            label="First sale"
            value={firstSaleStep?.status === "complete" ? "Done" : "Pending"}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Email guidance automation</CardTitle>
        <div className="mt-5 space-y-3">
          {emailPlan.map((mail) => (
            <div key={mail.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-text">{mail.subject}</p>
                <span className={emailStatusClassName(mail.status)}>{mail.status}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-text/72">{mail.description}</p>
              <Link href={mail.href as never} className="mt-3 inline-block text-sm font-semibold text-brand">
                Open related guide
              </Link>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Onboarding assistance</CardTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <AssistanceLink href="/demo" label="Video walkthrough" />
          <AssistanceLink href="/docs/getting-started" label="Step-by-step onboarding guide" />
          <AssistanceLink href="/docs/installation" label="Installation and troubleshooting" />
          <AssistanceLink href="/docs/license-activation" label="License activation help" />
          <AssistanceLink href="/portal/support" label="Contact support from portal" />
          <AssistanceLink href="/status" label="Check system status" />
        </div>
        <p className="mt-4 text-sm leading-6 text-text/65">
          Sample product import template:{" "}
          <a
            href="/templates/product-import-template.csv"
            className="font-semibold text-brand"
            download
          >
            CSV download
          </a>
        </p>
      </Card>

      <Card>
        <CardTitle>Common onboarding errors</CardTitle>
        <div className="mt-5 space-y-3 text-sm leading-6 text-text/72">
          <p>
            License activation failure: validate license status from{" "}
            <Link href="/portal/licenses" className="font-semibold text-brand">
              Licenses
            </Link>{" "}
            and open a support case if mismatch continues.
          </p>
          <p>
            Device limit reached: review active devices in{" "}
            <Link href="/portal/devices" className="font-semibold text-brand">
              Devices
            </Link>{" "}
            and deactivate unused records before retrying activation.
          </p>
          <p>
            Import errors: validate product template columns from the installation guide and retry from Desktop app.
          </p>
          <p>
            Connection issues: verify service availability on{" "}
            <Link href="/status" className="font-semibold text-brand">
              Status
            </Link>{" "}
            and submit a support request with error details.
          </p>
        </div>
      </Card>

      {completionRate === 100 ? (
        <Card className="border-success/35 bg-success/10">
          <CardTitle>Your store is ready. You can now start selling.</CardTitle>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/portal/downloads"
              className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
            >
              Open POS downloads
            </Link>
            <Link
              href="/portal/analytics"
              className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80"
            >
              View reports
            </Link>
            <Link
              href="/docs/desktop-guide"
              className="rounded-full border border-line px-5 py-3 text-sm font-semibold text-text/80"
            >
              Manage inventory guide
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-muted/30 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text/55">{label}</p>
      <p className="mt-2 text-base font-semibold text-text">{value}</p>
    </div>
  );
}

function AssistanceLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as never}
      className="rounded-[22px] border border-line bg-muted/30 px-4 py-4 text-sm font-semibold text-text/80 transition hover:border-brand hover:text-brand"
    >
      {label}
    </Link>
  );
}
