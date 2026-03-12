"use client";

import {
  buildCustomerSession,
  buildResellerSession,
  getStoredSession,
  saveSession
} from "@/lib/auth";
import {
  downloadArtifacts,
  getPlanByCode,
  type BillingCycle,
  type PlanCode
} from "@/lib/site-content";

export interface CustomerAccountRecord {
  id: string;
  tenantId?: string;
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  password: string;
  status: "prospect" | "active";
  createdAt: string;
  referredByCode?: string;
}

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  planCode: PlanCode;
  billingCycle: BillingCycle;
  status: "active" | "trialing" | "past_due";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
}

export interface LicenseRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  licenseKey: string;
  planCode: PlanCode;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "expiring" | "locked";
  deviceLimit: string;
  featureFlags: string[];
}

export interface BillingRecord {
  id: string;
  tenantId: string;
  subscriptionId: string;
  invoiceNo: string;
  provider: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: "paid" | "pending";
  issuedAt: string;
  paidAt?: string;
}

export interface DeviceRecord {
  id: string;
  tenantId: string;
  deviceName: string;
  platform: string;
  appVersion?: string;
  activatedAt: string;
  lastSeenAt: string;
  status: "ready" | "active";
}

export interface ResellerLeadRecord {
  id: string;
  fullName: string;
  companyName: string;
  city: string;
  phone: string;
  email: string;
  websiteOrSocialProof: string;
  experience: string;
  message: string;
  status: "pending" | "approved";
  referralCode: string;
  commissionRate: number;
  createdAt: string;
  password?: string;
}

export interface CommissionRecord {
  id: string;
  resellerId: string;
  tenantId: string;
  amount: number;
  rate: number;
  status: "accrued" | "paid";
  createdAt: string;
}

export interface CheckoutReceipt {
  id: string;
  tenantId: string;
  customerId: string;
  subscriptionId: string;
  licenseId: string;
  billingId: string;
  companyName: string;
  contactName: string;
  email: string;
  planCode: PlanCode;
  billingCycle: BillingCycle;
  amount: number;
  createdAt: string;
}

interface Phase1Store {
  customers: CustomerAccountRecord[];
  subscriptions: SubscriptionRecord[];
  licenses: LicenseRecord[];
  billing: BillingRecord[];
  devices: DeviceRecord[];
  resellerLeads: ResellerLeadRecord[];
  commissions: CommissionRecord[];
  receipts: CheckoutReceipt[];
}

export interface PersistedCheckoutResult {
  tenantId: string;
  subscriptionId: string;
  planCode: PlanCode;
  billingCycle: BillingCycle;
  invoiceNo: string;
  amount: number;
  provider: string;
  licenseKey: string;
  expiresAt: string;
  companyName: string;
  contactName: string;
  email: string;
}

export interface RegisterInput {
  fullName: string;
  companyName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface CheckoutInput extends RegisterInput {
  planCode: PlanCode;
  billingCycle: BillingCycle;
  paymentMethod: string;
  provider: string;
  taxOffice?: string;
  taxNumber?: string;
  addressLine?: string;
  city?: string;
  country?: string;
  locale?: string;
  couponCode?: string;
  resellerCode?: string;
}

export interface ResellerApplyInput {
  fullName: string;
  companyName: string;
  city: string;
  phone: string;
  email: string;
  websiteOrSocialProof: string;
  experience: string;
  message: string;
}

const STORAGE_KEY = "loomapos_phase1_store";

const emptyStore = (): Phase1Store => ({
  customers: [],
  subscriptions: [],
  licenses: [],
  billing: [],
  devices: [],
  resellerLeads: [],
  commissions: [],
  receipts: []
});

function makeId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

function makeInvoiceNo(date: Date) {
  return `INV-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

function makeLicenseKey() {
  const pieces = Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
  return `LMA-${pieces.join("-")}`;
}

function addPeriod(date: Date, cycle: BillingCycle) {
  const next = new Date(date);
  if (cycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

function writeStore(store: Phase1Store) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function seedStore(store: Phase1Store) {
  if (store.resellerLeads.some((item) => item.email === "partner@loomapos.com")) {
    return store;
  }

  const demoReseller: ResellerLeadRecord = {
    id: "reseller_demo",
    fullName: "Aylin Demir",
    companyName: "Marmara POS Danismanlik",
    city: "Istanbul",
    phone: "+90 532 111 22 33",
    email: "partner@loomapos.com",
    websiteOrSocialProof: "linkedin.com/company/marmarapos",
    experience: "7 yil perakende yazilim satis ve saha kurulum deneyimi",
    message: "Marmara bolgesi icin aktif cozum ortakligi yurutmek istiyoruz.",
    status: "approved",
    referralCode: "MARMAR429",
    commissionRate: 0.12,
    createdAt: new Date("2026-02-01T10:00:00.000Z").toISOString(),
    password: "Bayi123!"
  };

  return {
    ...store,
    resellerLeads: [...store.resellerLeads, demoReseller]
  };
}

function readStore() {
  if (typeof window === "undefined") {
    return emptyStore();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedStore(emptyStore());
    writeStore(seeded);
    return seeded;
  }

  try {
    return seedStore(JSON.parse(raw) as Phase1Store);
  } catch {
    const seeded = seedStore(emptyStore());
    writeStore(seeded);
    return seeded;
  }
}

export function registerCustomerAccount(input: RegisterInput) {
  const store = readStore();
  const existing = store.customers.find(
    (customer) => customer.email.toLowerCase() === input.email.toLowerCase()
  );

  if (existing) {
    if (existing.password !== input.password) {
      throw new Error("Bu e-posta ile zaten bir hesap olusturulmus.");
    }

    saveSession(
      buildCustomerSession({
        email: existing.email,
        displayName: existing.fullName,
        tenantId: existing.tenantId,
        companyName: existing.companyName
      })
    );

    return existing;
  }

  const account: CustomerAccountRecord = {
    id: makeId("cus"),
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim(),
    password: input.password,
    status: "prospect",
    createdAt: new Date().toISOString()
  };

  const nextStore = {
    ...store,
    customers: [account, ...store.customers]
  };
  writeStore(nextStore);

  saveSession(
    buildCustomerSession({
      email: account.email,
      displayName: account.fullName,
      companyName: account.companyName
    })
  );

  return account;
}

export function loginCustomer(email: string, password: string) {
  const store = readStore();
  const account = store.customers.find(
    (customer) =>
      customer.email.toLowerCase() === email.trim().toLowerCase() &&
      customer.password === password
  );

  if (!account) {
    throw new Error("Musteri hesabi bulunamadi veya sifre hatali.");
  }

  saveSession(
    buildCustomerSession({
      email: account.email,
      displayName: account.fullName,
      tenantId: account.tenantId,
      companyName: account.companyName
    })
  );

  return account;
}

export function completeCheckout(input: CheckoutInput) {
  const store = readStore();
  const now = new Date();
  const existingCustomer = store.customers.find(
    (customer) => customer.email.toLowerCase() === input.email.toLowerCase()
  );

  const tenantId = existingCustomer?.tenantId ?? makeId("tenant");
  const customerId = existingCustomer?.id ?? makeId("cus");
  const subscriptionId = makeId("sub");
  const licenseId = makeId("lic");
  const billingId = makeId("bill");
  const periodEnd = addPeriod(now, input.billingCycle);
  const plan = getPlanByCode(input.planCode);

  const customer: CustomerAccountRecord = {
    id: customerId,
    tenantId,
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim(),
    password: input.password,
    status: "active",
    createdAt: existingCustomer?.createdAt ?? now.toISOString(),
    referredByCode: input.resellerCode?.trim() || existingCustomer?.referredByCode
  };

  const subscription: SubscriptionRecord = {
    id: subscriptionId,
    tenantId,
    planCode: input.planCode,
    billingCycle: input.billingCycle,
    status: "active",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    createdAt: now.toISOString()
  };

  const license: LicenseRecord = {
    id: licenseId,
    tenantId,
    subscriptionId,
    licenseKey: makeLicenseKey(),
    planCode: input.planCode,
    issuedAt: now.toISOString(),
    expiresAt: periodEnd.toISOString(),
    status: "active",
    deviceLimit: plan.deviceLimit,
    featureFlags: plan.modules
  };

  const amount = input.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const billing: BillingRecord = {
    id: billingId,
    tenantId,
    subscriptionId,
    invoiceNo: makeInvoiceNo(now),
    provider: input.provider,
    paymentMethod: input.paymentMethod,
    amount,
    currency: "TRY",
    status: "paid",
    issuedAt: now.toISOString(),
    paidAt: now.toISOString()
  };

  const receipt: CheckoutReceipt = {
    id: makeId("chk"),
    tenantId,
    customerId,
    subscriptionId,
    licenseId,
    billingId,
    companyName: customer.companyName,
    contactName: customer.fullName,
    email: customer.email,
    planCode: input.planCode,
    billingCycle: input.billingCycle,
    amount,
    createdAt: now.toISOString()
  };

  const customers = [
    customer,
    ...store.customers.filter((item) => item.email.toLowerCase() !== customer.email.toLowerCase())
  ];

  const commissions = [...store.commissions];
  if (input.resellerCode) {
    const reseller = store.resellerLeads.find(
      (item) => item.referralCode.toLowerCase() === input.resellerCode?.trim().toLowerCase()
    );
    if (reseller) {
      commissions.unshift({
        id: makeId("com"),
        resellerId: reseller.id,
        tenantId,
        amount: Number((amount * reseller.commissionRate).toFixed(2)),
        rate: reseller.commissionRate,
        status: "accrued",
        createdAt: now.toISOString()
      });
    }
  }

  const nextStore: Phase1Store = {
    ...store,
    customers,
    subscriptions: [subscription, ...store.subscriptions.filter((item) => item.tenantId !== tenantId)],
    licenses: [license, ...store.licenses.filter((item) => item.tenantId !== tenantId)],
    billing: [billing, ...store.billing],
    receipts: [receipt, ...store.receipts],
    commissions
  };
  writeStore(nextStore);

  saveSession(
    buildCustomerSession({
      email: customer.email,
      displayName: customer.fullName,
      tenantId,
      companyName: customer.companyName
    })
  );

  return receipt;
}

export function persistCheckoutResult(
  input: CheckoutInput,
  result: PersistedCheckoutResult
) {
  const store = readStore();
  const nowIso = new Date().toISOString();
  const plan = getPlanByCode(result.planCode);
  const existingCustomer = store.customers.find(
    (customer) => customer.email.toLowerCase() === result.email.toLowerCase()
  );

  const customerId = existingCustomer?.id ?? makeId("cus");
  const licenseId = makeId("lic");
  const billingId = makeId("bill");
  const receiptId = makeId("chk");

  const customer: CustomerAccountRecord = {
    id: customerId,
    tenantId: result.tenantId,
    fullName: result.contactName,
    companyName: result.companyName,
    email: result.email.toLowerCase(),
    phone: input.phone?.trim(),
    password: input.password,
    status: "active",
    createdAt: existingCustomer?.createdAt ?? nowIso,
    referredByCode: input.resellerCode?.trim() || existingCustomer?.referredByCode
  };

  const subscription: SubscriptionRecord = {
    id: result.subscriptionId,
    tenantId: result.tenantId,
    planCode: result.planCode,
    billingCycle: result.billingCycle,
    status: "active",
    currentPeriodStart: nowIso,
    currentPeriodEnd: result.expiresAt,
    createdAt: nowIso
  };

  const license: LicenseRecord = {
    id: licenseId,
    tenantId: result.tenantId,
    subscriptionId: result.subscriptionId,
    licenseKey: result.licenseKey,
    planCode: result.planCode,
    issuedAt: nowIso,
    expiresAt: result.expiresAt,
    status: "active",
    deviceLimit: plan.deviceLimit,
    featureFlags: plan.modules
  };

  const billing: BillingRecord = {
    id: billingId,
    tenantId: result.tenantId,
    subscriptionId: result.subscriptionId,
    invoiceNo: result.invoiceNo,
    provider: result.provider,
    paymentMethod: input.paymentMethod,
    amount: result.amount,
    currency: "TRY",
    status: "paid",
    issuedAt: nowIso,
    paidAt: nowIso
  };

  const receipt: CheckoutReceipt = {
    id: receiptId,
    tenantId: result.tenantId,
    customerId,
    subscriptionId: result.subscriptionId,
    licenseId,
    billingId,
    companyName: result.companyName,
    contactName: result.contactName,
    email: result.email.toLowerCase(),
    planCode: result.planCode,
    billingCycle: result.billingCycle,
    amount: result.amount,
    createdAt: nowIso
  };

  const nextStore: Phase1Store = {
    ...store,
    customers: [
      customer,
      ...store.customers.filter((item) => item.email.toLowerCase() !== customer.email.toLowerCase())
    ],
    subscriptions: [
      subscription,
      ...store.subscriptions.filter((item) => item.tenantId !== result.tenantId)
    ],
    licenses: [license, ...store.licenses.filter((item) => item.tenantId !== result.tenantId)],
    billing: [billing, ...store.billing.filter((item) => item.invoiceNo !== result.invoiceNo)],
    receipts: [receipt, ...store.receipts],
    devices: store.devices,
    resellerLeads: store.resellerLeads,
    commissions: store.commissions
  };

  writeStore(nextStore);
  saveSession(
    buildCustomerSession({
      email: customer.email,
      displayName: customer.fullName,
      tenantId: result.tenantId,
      companyName: result.companyName
    })
  );

  return receipt;
}

export function getReceiptById(receiptId?: string | null) {
  const store = readStore();
  if (!receiptId) {
    return store.receipts[0] ?? null;
  }
  return store.receipts.find((item) => item.id === receiptId) ?? null;
}

export function getReceiptBundle(receiptId?: string | null) {
  const store = readStore();
  const receipt = getReceiptById(receiptId);

  if (!receipt) {
    return null;
  }

  return {
    receipt,
    customer: store.customers.find((item) => item.id === receipt.customerId) ?? null,
    subscription: store.subscriptions.find((item) => item.id === receipt.subscriptionId) ?? null,
    license: store.licenses.find((item) => item.id === receipt.licenseId) ?? null,
    billing: store.billing.find((item) => item.id === receipt.billingId) ?? null,
    downloads: downloadArtifacts
  };
}

export function getCustomerPortalSnapshot() {
  const session = getStoredSession();
  if (!session || session.portalType !== "customer" || !session.tenantId) {
    return null;
  }

  const store = readStore();
  const customer = store.customers.find((item) => item.tenantId === session.tenantId) ?? null;
  const subscription = store.subscriptions.find((item) => item.tenantId === session.tenantId) ?? null;
  const license = store.licenses.find((item) => item.tenantId === session.tenantId) ?? null;
  const billing = store.billing.filter((item) => item.tenantId === session.tenantId);
  const devices = store.devices.filter((item) => item.tenantId === session.tenantId);

  return {
    customer,
    subscription,
    license,
    billing,
    devices,
    downloads: downloadArtifacts
  };
}

export function mergeCustomerPortalSnapshot(snapshot: {
  tenantId: string;
  tenantName: string;
  subscription?: {
    planCode: string;
    billingCycle: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
  license?: {
    planCode: string;
    expiresAt: string;
    status: string;
  } | null;
  billing: BillingRecord[];
  devices: DeviceRecord[];
}) {
  const store = readStore();
  const customer = store.customers.find((item) => item.tenantId === snapshot.tenantId);

  const nextStore: Phase1Store = {
    ...store,
    customers: customer
      ? store.customers.map((item) =>
          item.tenantId === snapshot.tenantId
            ? { ...item, companyName: snapshot.tenantName }
            : item
        )
      : [
          {
            id: makeId("cus"),
            tenantId: snapshot.tenantId,
            fullName: snapshot.tenantName,
            companyName: snapshot.tenantName,
            email: getStoredSession()?.email ?? `${snapshot.tenantId}@local`,
            password: "portal-only",
            status: "active",
            createdAt: new Date().toISOString()
          },
          ...store.customers
        ],
    subscriptions: snapshot.subscription
      ? [
          {
            id:
              store.subscriptions.find((item) => item.tenantId === snapshot.tenantId)?.id ??
              makeId("sub"),
            tenantId: snapshot.tenantId,
            planCode: snapshot.subscription.planCode as PlanCode,
            billingCycle: snapshot.subscription.billingCycle as BillingCycle,
            status: snapshot.subscription.status as SubscriptionRecord["status"],
            currentPeriodStart: snapshot.subscription.currentPeriodStart,
            currentPeriodEnd: snapshot.subscription.currentPeriodEnd,
            createdAt: new Date().toISOString()
          },
          ...store.subscriptions.filter((item) => item.tenantId !== snapshot.tenantId)
        ]
      : store.subscriptions,
    licenses: snapshot.license
      ? [
          {
            id: store.licenses.find((item) => item.tenantId === snapshot.tenantId)?.id ?? makeId("lic"),
            tenantId: snapshot.tenantId,
            subscriptionId:
              store.subscriptions.find((item) => item.tenantId === snapshot.tenantId)?.id ?? makeId("sub"),
            licenseKey:
              store.licenses.find((item) => item.tenantId === snapshot.tenantId)?.licenseKey ??
              "PORTAL-LICENSE",
            planCode: snapshot.license.planCode as PlanCode,
            issuedAt: new Date().toISOString(),
            expiresAt: snapshot.license.expiresAt,
            status: snapshot.license.status as LicenseRecord["status"],
            deviceLimit:
              store.licenses.find((item) => item.tenantId === snapshot.tenantId)?.deviceLimit ??
              getPlanByCode(snapshot.license.planCode).deviceLimit,
            featureFlags:
              store.licenses.find((item) => item.tenantId === snapshot.tenantId)?.featureFlags ??
              getPlanByCode(snapshot.license.planCode).modules
          },
          ...store.licenses.filter((item) => item.tenantId !== snapshot.tenantId)
        ]
      : store.licenses,
    billing: [
      ...snapshot.billing,
      ...store.billing.filter(
        (item) =>
          item.tenantId !== snapshot.tenantId &&
          !snapshot.billing.some((incoming) => incoming.invoiceNo === item.invoiceNo)
      )
    ],
    devices: [
      ...snapshot.devices,
      ...store.devices.filter(
        (item) =>
          item.tenantId !== snapshot.tenantId &&
          !snapshot.devices.some((incoming) => incoming.id === item.id)
      )
    ]
  };

  writeStore(nextStore);
}

export function applyResellerLead(input: ResellerApplyInput) {
  const store = readStore();
  const existing = store.resellerLeads.find(
    (lead) => lead.email.toLowerCase() === input.email.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  const lead: ResellerLeadRecord = {
    id: makeId("rsl"),
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    city: input.city.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    websiteOrSocialProof: input.websiteOrSocialProof.trim(),
    experience: input.experience.trim(),
    message: input.message.trim(),
    status: "pending",
    referralCode: `${input.companyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() || "BAYI"}${Math.floor(100 + Math.random() * 899)}`,
    commissionRate: 0.1,
    createdAt: new Date().toISOString()
  };

  writeStore({
    ...store,
    resellerLeads: [lead, ...store.resellerLeads]
  });

  return lead;
}

export function persistResellerLeadResult(
  input: ResellerApplyInput,
  result: { code: string; status: string; commissionRate: number }
) {
  const store = readStore();
  const existing = store.resellerLeads.find(
    (lead) => lead.email.toLowerCase() === input.email.toLowerCase()
  );

  const lead: ResellerLeadRecord = {
    id: existing?.id ?? makeId("rsl"),
    fullName: input.fullName.trim(),
    companyName: input.companyName.trim(),
    city: input.city.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    websiteOrSocialProof: input.websiteOrSocialProof.trim(),
    experience: input.experience.trim(),
    message: input.message.trim(),
    status: result.status === "approved" ? "approved" : "pending",
    referralCode: result.code,
    commissionRate: result.commissionRate,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    password: existing?.password
  };

  writeStore({
    ...store,
    resellerLeads: [
      lead,
      ...store.resellerLeads.filter((item) => item.email.toLowerCase() !== lead.email.toLowerCase())
    ]
  });

  return lead;
}

export function loginReseller(email: string, password: string) {
  const store = readStore();
  const reseller = store.resellerLeads.find(
    (item) =>
      item.email.toLowerCase() === email.trim().toLowerCase() &&
      item.password === password &&
      item.status === "approved"
  );

  if (!reseller) {
    throw new Error("Onayli bayi hesabi bulunamadi veya sifre hatali.");
  }

  saveSession(
    buildResellerSession({
      email: reseller.email,
      displayName: reseller.companyName,
      resellerCode: reseller.referralCode
    })
  );

  return reseller;
}

export function getResellerPortalSnapshot() {
  const session = getStoredSession();
  if (!session || session.portalType !== "reseller" || !session.resellerCode) {
    return null;
  }

  const store = readStore();
  const reseller = store.resellerLeads.find(
    (item) => item.referralCode === session.resellerCode
  );

  if (!reseller) {
    return null;
  }

  const customers = store.customers.filter(
    (item) => item.referredByCode === reseller.referralCode
  );
  const commissions = store.commissions.filter(
    (item) => item.resellerId === reseller.id
  );

  return {
    reseller,
    customers,
    commissions,
    licenseReadyCustomers: customers.filter((customer) =>
      store.licenses.some((license) => license.tenantId === customer.tenantId)
    )
  };
}

export function mergeResellerDashboard(snapshot: {
  resellerCode: string;
  resellerName: string;
  status: string;
  commissionRate: number;
  commissions: CommissionRecord[];
}) {
  const store = readStore();
  const existing = store.resellerLeads.find((item) => item.referralCode === snapshot.resellerCode);

  if (existing) {
    writeStore({
      ...store,
      resellerLeads: store.resellerLeads.map((item) =>
        item.referralCode === snapshot.resellerCode
          ? {
              ...item,
              companyName: snapshot.resellerName,
              status: snapshot.status === "approved" ? "approved" : "pending",
              commissionRate: snapshot.commissionRate
            }
          : item
      ),
      commissions: [
        ...snapshot.commissions,
        ...store.commissions.filter((item) => item.resellerId !== existing.id)
      ]
    });
  }
}
