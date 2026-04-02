import { clearSession, getValidSession } from "@/lib/auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";
export const BRANCH_ID = process.env.NEXT_PUBLIC_BRANCH_ID ?? "00000000-0000-0000-0000-000000000001";

type RequestOptions = RequestInit & {
  ignoreTenantHeaders?: boolean;
};

export async function apiFetch<T>(path: string, options?: RequestOptions): Promise<T> {
  const authSession = typeof window !== "undefined" ? await getValidSession() : null;
  const isFormData =
    typeof FormData !== "undefined" &&
    options?.body instanceof FormData;

  const headers = new Headers(options?.headers ?? undefined);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authSession?.accessToken) {
    headers.set("Authorization", `Bearer ${authSession.accessToken}`);
  }
  if (!options?.ignoreTenantHeaders) {
    headers.set("X-Tenant-Id", TENANT_ID);
    headers.set("X-Branch-Id", BRANCH_ID);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
    }
    const message = await response.text();
    throw new Error(`API ${response.status}: ${message}`);
  }

  return (await response.json()) as T;
}

export async function commerceFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const authSession = typeof window !== "undefined" ? await getValidSession() : null;
  const isFormData =
    typeof FormData !== "undefined" &&
    options?.body instanceof FormData;

  const headers = new Headers(options?.headers ?? undefined);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authSession?.accessToken) {
    headers.set("Authorization", `Bearer ${authSession.accessToken}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
    }
    const message = await response.text();
    throw new Error(`API ${response.status}: ${message}`);
  }

  return (await response.json()) as T;
}

export interface PortalAuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
  portalType: "customer" | "reseller" | "internal";
  roles: string[];
  email: string;
  displayName: string;
  tenantId?: string | null;
  companyName?: string | null;
  resellerCode?: string | null;
}

export interface CommerceFeatureFlagDto {
  code: string;
  name: string;
}

export interface CommercePlanPriceDto {
  id: string;
  billingPeriod: string;
  currency: string;
  amount: number;
  promoAmount?: number | null;
  trialDays: number;
}

export interface CommercePricingPlanDto {
  id: string;
  code: string;
  name: string;
  description: string;
  branchLimit?: number | null;
  userLimit?: number | null;
  deviceLimit?: number | null;
  supportTier: string;
  resellerCommissionEligibility: boolean;
  highlightLabel: string;
  prices: CommercePlanPriceDto[];
  features: CommerceFeatureFlagDto[];
}

export interface CommerceDownloadAssetDto {
  assetId: string;
  releaseId: string;
  platform: string;
  title: string;
  version: string;
  releaseDate: string;
  visibility: string;
  downloadUrl: string;
  releaseNotesMarkdown: string;
  installGuideMarkdown: string;
  minimumRequirements: string;
}

export interface CommerceCheckoutStatusDto {
  checkoutSessionId: string;
  checkoutReference: string;
  companyName: string;
  planCode: string;
  billingPeriod: string;
  status: string;
  paymentStatus: string;
  provider: string;
  providerSessionId?: string | null;
  providerPaymentReference?: string | null;
  amount: number;
  taxAmount: number;
  currency: string;
  tenantId?: string | null;
  customerAccountId?: string | null;
  subscriptionId?: string | null;
  invoiceNo?: string | null;
  licenseKey?: string | null;
  licenseToken?: string | null;
  licenseStatus?: string | null;
  licenseExpiresAt?: string | null;
  downloads: CommerceDownloadAssetDto[];
}

export interface CommerceCheckoutLaunchDto {
  checkout: CommerceCheckoutStatusDto;
  providerStatus: string;
  checkoutUrl?: string | null;
  requiresProviderAction: boolean;
}

export interface CommercePortalOverviewDto {
  companyName: string;
  activePlan?: string | null;
  renewalDate?: string | null;
  billingPeriod?: string | null;
  licenseStatus?: string | null;
  activeDevices: number;
  latestInvoice?: {
    id: string;
    invoiceNo: string;
    total: number;
    currency: string;
    status: string;
    issuedAt: string;
  } | null;
  downloads: CommerceDownloadAssetDto[];
}

export interface CommercePortalSubscriptionDto {
  id: string;
  tenantId: string;
  billingProfileId?: string | null;
  planCode: string;
  billingCycle: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  renewalDate?: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  providerSubscriptionId?: string | null;
  providerCustomerReference?: string | null;
  planSnapshotJson: string;
  resellerCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommercePortalLicenseDto {
  id: string;
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  licenseKey: string;
  licenseToken: string;
  signature: string;
  featuresJson: string;
  deviceLimit?: number | null;
  issuedAt: string;
  expiresAt: string;
  graceDays: number;
  status: string;
  createdAt: string;
}

export interface CommercePortalBillingItemDto {
  id: string;
  invoiceNo: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt?: string | null;
  pdfUrl?: string | null;
  paymentMethodSummary?: string | null;
  provider?: string | null;
}

export interface CommercePortalDeviceDto {
  id: string;
  tenantId: string;
  licenseId?: string | null;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion?: string | null;
  activationSource?: string | null;
  status: string;
  activatedAt: string;
  lastSeenAt: string;
  revokedAt?: string | null;
  updatedAt: string;
}

export interface CommercePortalCompanyDto {
  id: string;
  companyName: string;
  tenantCode: string;
  billingEmail: string;
  taxOffice?: string | null;
  taxNumber?: string | null;
  country: string;
  locale: string;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  status: string;
}

export interface CommerceSupportLinkDto {
  label: string;
  href: string;
}

export interface CommercePlanDto {
  code: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxBranches?: number | null;
  maxUsers?: number | null;
  maxDevices?: number | null;
  features: string[];
}

export interface CommerceCheckoutResponseDto {
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  billingCycle: string;
  invoiceNo: string;
  amount: number;
  provider: string;
  licenseToken: string;
  expiresAt: string;
  downloads: {
    desktopWindows: string;
    mobileAndroid: string;
    mobileIos: string;
  };
  portalUrl: string;
}

export interface CommercePortalDto {
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
    graceDays: number;
    status: string;
  } | null;
  invoices: Array<{
    invoiceNo: string;
    total: number;
    currency: string;
    status: string;
    issuedAt: string;
    paidAt?: string | null;
  }>;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion?: string | null;
    activatedAt: string;
    lastSeenAt: string;
  }>;
}

export interface ResellerApplyResponseDto {
  code: string;
  status: string;
  commissionRate: number;
}

export interface ResellerDashboardDto {
  code: string;
  name: string;
  status: string;
  commissionRate: number;
  customerCount: number;
  accruedTotal: number;
  paidTotal: number;
  commissions: Array<{
    id: string;
    tenantId: string;
    amount: number;
    rate: number;
    status: string;
    accruedAt: string;
    paidAt?: string | null;
  }>;
}

export interface ProductDto {
  id: string;
  name: string;
  categoryId?: string | null;
  categoryName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  unit: string;
  salePrice: number;
  purchasePrice: number;
  taxRate: number;
  stockTrackingEnabled: boolean;
  minStock: number;
  isActive: boolean;
  stockQty: number;
}

export interface SaleListItemDto {
  id: string;
  branchId: string;
  deviceId: string;
  receiptNo: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface SaleLineDto {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface PaymentDto {
  id: string;
  method: string;
  amount: number;
  createdAt: string;
}

export interface SaleDetailDto {
  id: string;
  branchId: string;
  deviceId: string;
  receiptNo: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  lines: SaleLineDto[];
  payments: PaymentDto[];
}

export interface StockBalanceDto {
  productId: string;
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  branchId: string;
  branchName: string;
  qty: number;
  minStock: number;
  stockTrackingEnabled: boolean;
  status: "OK" | "KRITIK" | "IZLENMIYOR";
}

export interface ContactDto {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  email?: string | null;
  balance: number;
  lastTransactionAt?: string | null;
}

export interface ContactLedgerDto {
  id: string;
  amountDelta: number;
  reason: string;
  refType: string;
  refId: string;
  createdAt: string;
}

export interface CashTransactionDto {
  id: string;
  branchId: string;
  type: "In" | "Out" | "in" | "out";
  amount: number;
  reason: string;
  createdAt: string;
}

export interface DailySalesReportDto {
  date: string;
  branchId: string;
  saleCount: number;
  totalAmount: number;
  totalDiscount: number;
  totalTax: number;
}

export interface TopProductDto {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface TenantDto {
  id: string;
  name: string;
  settingsJson?: string | null;
  settings?: TenantSettingsDto | null;
  createdAt: string;
}

export interface TenantSettingsDto {
  logoUrl?: string | null;
  taxNumber?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  receiptFooter?: string | null;
  defaultOpeningCash?: number | null;
  receiptPrinter?: string | null;
  currency?: string | null;
  defaultPaymentMethod?: string | null;
  licensePlan?: string | null;
  licenseNextPaymentDate?: string | null;
}

export interface LicenseLimitsDto {
  maxBranches?: number | null;
  maxUsers?: number | null;
  maxDevices?: number | null;
}

export interface LicenseUsageDto {
  branches: number;
  users: number;
  devices: number;
}

export interface LicenseDto {
  plan: string;
  limits: LicenseLimitsDto;
  usage: LicenseUsageDto;
  nextPaymentDate?: string | null;
}

export interface BranchSettingsDto {
  receiptHeader?: string | null;
  defaultTaxRate?: number | null;
  openingCash?: number | null;
}

export interface BranchDto {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  settings?: BranchSettingsDto | null;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  attributesJson: string;
  priceDelta: number;
  stockTrackingEnabled: boolean;
  isActive: boolean;
}

export interface RoleDto {
  id: string;
  name: string;
}

export interface UserRoleDto {
  id: string;
  name: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  isActive: boolean;
  createdAt: string;
  roles: UserRoleDto[];
}

export interface DailySalesLineDto {
  saleId: string;
  time: string;
  receiptNo: string;
  branchId: string;
  branchName?: string | null;
  cashierId: string;
  cashierName: string;
  status: string;
  total: number;
}

export interface BranchSalesDto {
  branchId: string;
  branchName?: string | null;
  sales: number;
  transactions: number;
}

export interface CashReportDto {
  cashierId: string;
  cashierName: string;
  cash: number;
  card: number;
  total: number;
}

export interface StockReportDto {
  productId: string;
  productName: string;
  branchId: string;
  branchName?: string | null;
  qty: number;
  minStock: number;
  status: string;
}

export interface RefundReportDto {
  saleId: string;
  time: string;
  receiptNo: string;
  branchId: string;
  branchName?: string | null;
  cashierId: string;
  cashierName: string;
  status: string;
  amount: number;
}

