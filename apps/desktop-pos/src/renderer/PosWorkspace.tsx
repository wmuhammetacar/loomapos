import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesktopEndOfDaySummary,
  DesktopLicenseStatus,
  DesktopPaymentMethod,
  DesktopProduct,
  DesktopRefundCandidateLine,
  DesktopRefundCandidateSale,
  DesktopRefundPaymentMode,
  DesktopShiftSummary,
  DesktopSyncDiagnostics,
  DesktopSyncStatus,
  DesktopXReportSummary,
  DesktopZReportPreview
} from "./global";

type PaymentMethod = DesktopPaymentMethod;
type RefundPaymentMode = DesktopRefundPaymentMode;
type RefundMode = "RECEIPT" | "DIRECT";
type ModalType =
  | "NONE"
  | "PAYMENT_CASH"
  | "PAYMENT_CARD"
  | "PRODUCT_NOT_FOUND"
  | "REFUND"
  | "DISCOUNT"
  | "CUSTOMER"
  | "DAY_END"
  | "SHIFT"
  | "CASH_ADJUSTMENT"
  | "DIAGNOSTICS";

interface CartLine {
  productId: string;
  name: string;
  taxRate: number;
  qty: number;
  unitPrice: number;
  discount: number;
}

interface DirectRefundLine {
  productId: string;
  name: string;
  taxRate: number;
  qty: number;
  unitPrice: number;
  discount: number;
}

interface ToastState {
  kind: "success" | "warning" | "danger";
  message: string;
}

interface AppInfoState {
  tenantId: string;
  branchId: string;
  deviceId: string;
  branchName: string;
  deviceName: string;
  cashierName: string;
  cashierRole: string;
  canManageCatalog: boolean;
  license: DesktopLicenseStatus;
  shift: DesktopShiftSummary | null;
}

const nowDateInput = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

const fmtNumber = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value);

const shortId = (value: string) => value.slice(0, 8).toUpperCase();

const getInitialAppInfo = (): AppInfoState => ({
  tenantId: "00000000-0000-0000-0000-000000000001",
  branchId: "00000000-0000-0000-0000-000000000001",
  deviceId: "00000000-0000-0000-0000-000000000001",
  branchName: "Sube",
  deviceName: "Kasa",
  cashierName: "Kasiyer",
  cashierRole: "cashier_limited",
  canManageCatalog: false,
  license: {
    status: "UNKNOWN",
    planCode: null,
    expiresAt: null,
    graceDays: null,
    maxDevices: null,
    activeDevices: null,
    message: null,
    lastCheckedAt: null,
    lifecycleState: null,
    allowedActions: [],
    blockedActions: [],
    canCheckout: false,
    canWrite: false,
    canSync: false,
    canView: true,
    requiresUpgradeAction: false,
    requiresBlock: false
  },
  shift: null
});

const round2 = (value: number) => Math.round(value * 100) / 100;

const parseAmountInput = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
};

type TrialLifecycleState =
  | "trial_active"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_canceled"
  | "suspended_blocked";

interface TrialLifecycleDescriptor {
  state: TrialLifecycleState;
  label: string;
  message: string;
  nextAction: string;
  allowedActions: string[];
  blockedActions: string[];
  daysRemaining: number | null;
}

const getDaysRemaining = (expiresAt: string | null) => {
  if (!expiresAt) {
    return null;
  }
  const end = new Date(expiresAt).getTime();
  if (Number.isFinite(end) === false) {
    return null;
  }
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
};

const normalizeLifecycleState = (rawState: string | null | undefined): TrialLifecycleState => {
  const normalized = (rawState ?? "").trim().toLowerCase();
  if (normalized === "trial_active") {
    return "trial_active";
  }
  if (normalized === "trial_expiring" || normalized === "trial_expiring_soon") {
    return "trial_expiring";
  }
  if (normalized === "trial_expired" || normalized === "trial_expired_read_only") {
    return "trial_expired";
  }
  if (normalized === "subscription_past_due" || normalized === "past_due" || normalized === "past-due") {
    return "subscription_past_due";
  }
  if (normalized === "subscription_canceled" || normalized === "canceled" || normalized === "cancelled") {
    return "subscription_canceled";
  }
  if (normalized === "suspended_blocked" || normalized === "suspended" || normalized === "blocked" || normalized === "revoked") {
    return "suspended_blocked";
  }
  return "subscription_active";
};

const lifecycleTextByState: Record<TrialLifecycleState, Pick<TrialLifecycleDescriptor, "label" | "message" | "nextAction">> = {
  trial_active: {
    label: "Deneme aktif",
    message: "Deneme aktif. Operasyon yazma islemleri acik. Deneme sonunda yukseltme yapilmazsa sistem salt-okunur moda gecer.",
    nextAction: "Web portal > Abonelik adimindan plani simdiden secin"
  },
  trial_expiring: {
    label: "Deneme bitmek uzere",
    message: "Deneme bitmek uzere. Sure dolunca operasyon yazma kapanir ve sistem salt-okunur moda gecer.",
    nextAction: "Kesinti olmamasi icin simdi yukseltin (Web portal > Abonelik)"
  },
  trial_expired: {
    label: "Deneme bitti / salt-okunur",
    message: "Deneme suresi doldu. Goruntuleme acik, operasyon yazma akisleri kapali.",
    nextAction: "Yukseltin ve operasyon yazmayi tekrar acin (Web portal > Abonelik)"
  },
  subscription_active: {
    label: "Abonelik aktif",
    message: "Abonelik aktif. Tum izinli operasyon akislari acik.",
    nextAction: "Normal operasyona devam"
  },
  subscription_past_due: {
    label: "Odeme gecikmis",
    message: "Abonelik odemesi gecikmis. Operasyon kisitlanmadan once odeme guncellenmelidir.",
    nextAction: "Web portal > Faturalama adimindan odemeyi tamamlayin"
  },
  subscription_canceled: {
    label: "Abonelik iptal",
    message: "Abonelik iptal durumunda. Donem sonunda operasyon yazma akisleri kapanabilir.",
    nextAction: "Web portal > Abonelik adimindan yenilemeyi tekrar acin"
  },
  suspended_blocked: {
    label: "Askida / bloklu",
    message: "Hesap bloklu oldugu icin operasyon yazma akisleri kapali.",
    nextAction: "Web portal > Abonelik/Lisans durumunu kontrol edin veya destekle iletisime gecin"
  }
};

const resolveDesktopTrialLifecycle = (license: DesktopLicenseStatus): TrialLifecycleDescriptor => {
  const state = normalizeLifecycleState(license.lifecycleState);
  const copy = lifecycleTextByState[state];
  const daysRemaining = getDaysRemaining(license.expiresAt);

  return {
    state,
    label: copy.label,
    message: copy.message,
    nextAction: copy.nextAction,
    allowedActions: license.allowedActions.length > 0 ? license.allowedActions : ["-"],
    blockedActions: license.blockedActions.length > 0 ? license.blockedActions : ["-"],
    daysRemaining
  };
};

const calcLineTotal = (qty: number, unitPrice: number, discount: number, taxRate: number) => {
  const subtotal = Math.max(0, qty) * Math.max(0, unitPrice);
  const normalizedDiscount = Math.max(0, discount);
  const base = Math.max(0, subtotal - normalizedDiscount);
  const tax = (base * Math.max(0, taxRate)) / 100;
  return round2(base + tax);
};

export interface PosWorkspaceProps {
  onOpenSettings: () => void;
  onLogout: () => Promise<void>;
  onboardingHint?: string | null;
  onSaleCompleted?: (result: { saleId: string; receiptNo: string; total: number }) => void;
}

export function PosWorkspace({ onOpenSettings, onLogout, onboardingHint, onSaleCompleted }: PosWorkspaceProps) {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const refundInputRef = useRef<HTMLInputElement>(null);

  const [appInfo, setAppInfo] = useState<AppInfoState>(getInitialAppInfo);
  const [clock, setClock] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [missingBarcode, setMissingBarcode] = useState("");
  const [products, setProducts] = useState<DesktopProduct[]>([]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [discountDraft, setDiscountDraft] = useState("0.00");
  const [customerName, setCustomerName] = useState("");

  const [activeModal, setActiveModal] = useState<ModalType>("NONE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState("0.00");
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [addedLineId, setAddedLineId] = useState<string | null>(null);
  const [showSaleCompleted, setShowSaleCompleted] = useState(false);

  const [syncStatus, setSyncStatus] = useState<DesktopSyncStatus | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState<DesktopSyncDiagnostics | null>(null);
  const [shiftSummary, setShiftSummary] = useState<DesktopShiftSummary | null>(null);
  const [openingShiftCash, setOpeningShiftCash] = useState("0.00");
  const [cashAdjustmentType, setCashAdjustmentType] = useState<"cash_in" | "cash_out" | "correction">("cash_out");
  const [cashAdjustmentAmount, setCashAdjustmentAmount] = useState("0.00");
  const [cashAdjustmentReason, setCashAdjustmentReason] = useState("");
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);
  const [isRecordingCashAdjustment, setIsRecordingCashAdjustment] = useState(false);
  const [reportDate, setReportDate] = useState(nowDateInput());
  const [reportSummary, setReportSummary] = useState<DesktopEndOfDaySummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [refundMode, setRefundMode] = useState<RefundMode>("RECEIPT");
  const [refundSearchValue, setRefundSearchValue] = useState("");
  const [refundCandidate, setRefundCandidate] = useState<DesktopRefundCandidateSale | null>(null);
  const [refundQtyByLineId, setRefundQtyByLineId] = useState<Record<string, number>>({});
  const [refundDirectLines, setRefundDirectLines] = useState<DirectRefundLine[]>([]);
  const [refundPaymentMode, setRefundPaymentMode] = useState<RefundPaymentMode>("SAME_AS_ORIGINAL");
  const [refundReturnToStock, setRefundReturnToStock] = useState(true);
  const [refundReasonCode, setRefundReasonCode] = useState("");
  const [isCreatingRefund, setIsCreatingRefund] = useState(false);
  const [isLoadingRefundSale, setIsLoadingRefundSale] = useState(false);

  const [dayEndDate, setDayEndDate] = useState(nowDateInput());
  const [xReport, setXReport] = useState<DesktopXReportSummary | null>(null);
  const [openingCash, setOpeningCash] = useState("0.00");
  const [countedCash, setCountedCash] = useState("0.00");
  const [zPreview, setZPreview] = useState<DesktopZReportPreview | null>(null);
  const [isLoadingXReport, setIsLoadingXReport] = useState(false);
  const [isPrintingXReport, setIsPrintingXReport] = useState(false);
  const [isClosingZReport, setIsClosingZReport] = useState(false);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const lineDiscount = cart.reduce((sum, line) => sum + line.discount, 0);
    const discount = Math.max(0, lineDiscount + headerDiscount);
    const tax = cart.reduce((sum, line) => {
      const base = Math.max(0, line.qty * line.unitPrice - line.discount);
      return sum + (base * line.taxRate) / 100;
    }, 0);
    return {
      subtotal: round2(subtotal),
      discount: round2(discount),
      tax: round2(tax),
      total: round2(Math.max(0, subtotal - discount + tax))
    };
  }, [cart, headerDiscount]);

  const lifecycle = useMemo(() => resolveDesktopTrialLifecycle(appInfo.license), [appInfo.license]);
  const writeLocked = appInfo.license.canWrite === false;

  const ensureOperationalWriteAllowed = () => {
    if (writeLocked) {
      pushToast("warning", lifecycle.label + ": " + lifecycle.message);
      return false;
    }
    return true;
  };

  const selectedReceiptRefundLines = useMemo(() => {
    if (!refundCandidate) {
      return [] as Array<{
        line: DesktopRefundCandidateLine;
        qty: number;
        discount: number;
        lineTotal: number;
      }>;
    }

    return refundCandidate.lines
      .map((line) => {
        const rawQty = Number(refundQtyByLineId[line.saleLineId] ?? 0);
        const qty = Math.max(0, Math.min(line.qty, rawQty));
        if (qty <= 0) {
          return null;
        }

        const proportionalDiscount = line.qty > 0 ? round2((line.discount * qty) / line.qty) : 0;
        return {
          line,
          qty,
          discount: proportionalDiscount,
          lineTotal: calcLineTotal(qty, line.unitPrice, proportionalDiscount, line.taxRate)
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [refundCandidate, refundQtyByLineId]);

  const selectedDirectRefundLines = useMemo(
    () =>
      refundDirectLines
        .map((line) => {
          const qty = Math.max(0, line.qty);
          if (qty <= 0) {
            return null;
          }
          return {
            line,
            qty,
            lineTotal: calcLineTotal(qty, line.unitPrice, line.discount, line.taxRate)
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [refundDirectLines]
  );

  const refundTotal = useMemo(() => {
    if (refundMode === "RECEIPT") {
      return round2(selectedReceiptRefundLines.reduce((sum, item) => sum + item.lineTotal, 0));
    }
    return round2(selectedDirectRefundLines.reduce((sum, item) => sum + item.lineTotal, 0));
  }, [refundMode, selectedDirectRefundLines, selectedReceiptRefundLines]);

  const pendingSyncCount = syncDiagnostics?.pendingCount ?? (syncStatus?.pending ?? 0);
  const failedSyncCount = syncDiagnostics?.failedCount ?? ((syncStatus?.failed ?? 0) + (syncStatus?.deadLetter ?? 0));
  const syncHealth = syncDiagnostics?.health ?? "delayed";
  const syncHealthLabel = syncHealth === "healthy" ? "healthy" : syncHealth === "failed" ? "failed" : "delayed";
  const syncWarningText = failedSyncCount > 0
    ? `${failedSyncCount} sync hatasi var`
    : pendingSyncCount > 0
      ? `${pendingSyncCount} islem senkron bekliyor`
      : "Senkron normal";
  const cloudOnline = isOnline && (syncStatus?.connectionQuality ?? "online") !== "offline";
  const hasDraft = cart.length > 0 || headerDiscount > 0 || customerName.trim().length > 0;
  const activeShift = shiftSummary?.activeSession ?? null;
  const shiftLabel = activeShift ? `Acik ${new Date(activeShift.openedAt).toLocaleTimeString("tr-TR")}` : "Kapali";

  useEffect(() => {
    void initialize();

    const syncTimer = window.setInterval(() => {
      void refreshSync();
    }, 5000);
    const clockTimer = window.setInterval(() => {
      setClock(new Date());
    }, 1000);
    const onlineHandler = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", onlineHandler);

    return () => {
      window.clearInterval(syncTimer);
      window.clearInterval(clockTimer);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", onlineHandler);
    };
  }, []);

  useEffect(() => {
    if (activeModal === "NONE") {
      barcodeInputRef.current?.focus();
    }
    if (activeModal === "REFUND") {
      window.setTimeout(() => {
        refundInputRef.current?.focus();
      }, 0);
    }
  }, [activeModal]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (showSaleCompleted) {
      return;
    }
    void window.posApi.customerDisplayUpdate({
      state: "ACTIVE",
      lines: cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        lineTotal: calcLineTotal(line.qty, line.unitPrice, line.discount, line.taxRate)
      })),
      total: totals.total
    });
  }, [cart, showSaleCompleted, totals.total]);

  useEffect(() => {
    if (!appInfo.tenantId || appInfo.tenantId === "00000000-0000-0000-0000-000000000001") {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!hasDraft) {
        void window.posApi.clearCartDraft();
        return;
      }

      void window.posApi.saveCartDraft({
        payloadJson: JSON.stringify({
          cart,
          headerDiscount,
          customerName,
          paymentDraft: {
            method: paymentMethod,
            cashReceived: Number.isFinite(Number(cashReceived)) ? parseAmountInput(cashReceived) : null
          },
          updatedAt: new Date().toISOString()
        })
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [appInfo.tenantId, cart, cashReceived, customerName, hasDraft, headerDiscount, paymentMethod]);

  useEffect(() => {
    if (activeModal !== "DAY_END") {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshZPreview(dayEndDate, openingCash, countedCash);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [activeModal, countedCash, dayEndDate, openingCash]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (event.key === "Escape" && activeModal !== "NONE") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (activeModal !== "NONE") {
        if (event.key === "Enter") {
          if (activeModal === "PAYMENT_CASH") {
            event.preventDefault();
            void completeSale("CASH");
          } else if (activeModal === "PAYMENT_CARD") {
            event.preventDefault();
            void completeSale("CARD");
          }
        }
        return;
      }

      if (event.key === "F1") {
        event.preventDefault();
        startNewSale();
      } else if (event.key === "F2") {
        event.preventDefault();
        openRefundModal();
      } else if (event.key === "F3") {
        event.preventDefault();
        setDiscountDraft(headerDiscount.toFixed(2));
        setActiveModal("DISCOUNT");
      } else if (event.key === "F4") {
        event.preventDefault();
        setActiveModal("CUSTOMER");
      } else if (event.key === "F5") {
        event.preventDefault();
        setActiveModal("SHIFT");
      } else if (event.key === "F6") {
        event.preventDefault();
        setActiveModal("CASH_ADJUSTMENT");
      } else if (event.key === "F7") {
        event.preventDefault();
        void openDayEndModal();
      } else if (event.key === "F8") {
        event.preventDefault();
        setActiveModal("DIAGNOSTICS");
      } else if (event.key === "F9") {
        event.preventDefault();
        openPaymentModal("CASH");
      } else if (event.key === "F10") {
        event.preventDefault();
        openPaymentModal("CARD");
      } else if (event.key === "Delete" && selectedLineId) {
        event.preventDefault();
        removeLine(selectedLineId);
      } else if ((event.key === "+" || (event.key === "=" && event.shiftKey)) && selectedLineId && !isTypingTarget) {
        event.preventDefault();
        changeLineQty(selectedLineId, 1);
      } else if (event.key === "-" && selectedLineId && !isTypingTarget) {
        event.preventDefault();
        changeLineQty(selectedLineId, -1);
      } else if (event.key === "Enter" && !isTypingTarget) {
        event.preventDefault();
        openPaymentModal(paymentMethod);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModal, headerDiscount, paymentMethod, selectedLineId, shiftSummary]);

  async function initialize() {
    await window.posApi.ping();
    const info = await window.posApi.getAppInfo();
    setAppInfo({
      tenantId: info.tenantId,
      branchId: info.branchId,
      deviceId: info.deviceId,
      branchName: info.branchName,
      deviceName: info.deviceName,
      cashierName: info.cashierName,
      cashierRole: info.cashierRole,
      canManageCatalog: info.canManageCatalog,
      license: info.license,
      shift: info.shift ?? null
    });
    setSyncStatus(info.sync);
    setSyncDiagnostics(await window.posApi.getSyncDiagnostics());
    setShiftSummary(info.shift ?? null);

    const recoveredDraft = await window.posApi.restoreCartDraft();
    if (recoveredDraft.restored && recoveredDraft.draft) {
      setCart(recoveredDraft.draft.cart);
      setHeaderDiscount(recoveredDraft.draft.headerDiscount);
      setDiscountDraft(recoveredDraft.draft.headerDiscount.toFixed(2));
      setCustomerName(recoveredDraft.draft.customerName);
      setPaymentMethod(recoveredDraft.draft.paymentDraft.method);
      setCashReceived((recoveredDraft.draft.paymentDraft.cashReceived ?? 0).toFixed(2));

      if (recoveredDraft.warningCode === "missing_products" && recoveredDraft.skippedProductCount > 0) {
        pushToast("warning", recoveredDraft.skippedProductCount + " urun taslagi atlandi.");
      }
    } else if (recoveredDraft.warningCode === "stale") {
      pushToast("warning", "Kayitli sepet taslagi eski oldugu icin yuklenmedi.");
    } else if (recoveredDraft.warningCode === "invalid") {
      pushToast("warning", "Kayitli sepet taslagi bozuk oldugu icin temizlendi.");
    }

    await Promise.all([searchProducts(), refreshSync(), refreshShiftStatus(), refreshSummary(reportDate)]);
  }

  function pushToast(kind: ToastState["kind"], message: string) {
    setToast({ kind, message });
  }

  async function searchProducts(nextSearch?: string) {
    const rows = await window.posApi.listProducts({ search: nextSearch ?? search });
    setProducts(rows);
  }

  async function refreshSync() {
    const [status, diagnostics] = await Promise.all([
      window.posApi.getSyncStatus(),
      window.posApi.getSyncDiagnostics()
    ]);
    setSyncStatus(status);
    setSyncDiagnostics(diagnostics);
  }

  async function refreshShiftStatus() {
    const next = await window.posApi.getShiftStatus();
    setShiftSummary(next);
    setAppInfo((current) => ({
      ...current,
      shift: next
    }));
    if (next.activeSession) {
      setOpeningCash(next.activeSession.openingCashAmount.toFixed(2));
    }
  }

  async function refreshSummary(nextDate = reportDate) {
    const summary = await window.posApi.getEndOfDay({ date: nextDate });
    setReportSummary(summary);
  }

  async function refreshXReport(nextDate = dayEndDate) {
    setIsLoadingXReport(true);
    try {
      const report = await window.posApi.getXReport({ date: nextDate });
      setXReport(report);
    } finally {
      setIsLoadingXReport(false);
    }
  }

  async function refreshZPreview(nextDate = dayEndDate, opening = openingCash, counted = countedCash) {
    try {
      const preview = await window.posApi.getZPreview({
        date: nextDate,
        openingCash: parseAmountInput(opening),
        countedCash: parseAmountInput(counted)
      });
      setZPreview(preview);
    } catch {
      setZPreview(null);
    }
  }

  function addToCart(product: DesktopProduct) {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          taxRate: Number(product.taxRate ?? 0),
          qty: 1,
          unitPrice: Number(product.price ?? 0),
          discount: 0
        }
      ];
    });
    setSelectedLineId(product.id);
    setAddedLineId(product.id);
    window.setTimeout(() => setAddedLineId((current) => (current === product.id ? null : current)), 120);
  }

  function resetSaleDraft() {
    setCart([]);
    setSelectedLineId(null);
    setHeaderDiscount(0);
    setDiscountDraft("0.00");
    setBarcodeInput("");
    setCustomerName("");
    void window.posApi.clearCartDraft();
  }

  function startNewSale() {
    resetSaleDraft();
    pushToast("success", "Yeni satis hazir.");
  }

  function changeLineQty(productId: string, delta: number) {
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, qty: Math.max(0.001, line.qty + delta) } : line
      )
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
    setSelectedLineId((current) => (current === productId ? null : current));
  }

  async function handleBarcodeEnter() {
    const value = barcodeInput.trim();
    if (value.length === 0) {
      if (cart.length > 0) {
        openPaymentModal(paymentMethod);
      }
      return;
    }

    const rows = await window.posApi.listProducts({ barcode: value });
    if (rows.length > 0) {
      addToCart(rows[0]);
      setBarcodeInput("");
      pushToast("success", `${rows[0].name} sepete eklendi.`);
      return;
    }

    setMissingBarcode(value);
    setActiveModal("PRODUCT_NOT_FOUND");
    pushToast("warning", "Urun bulunamadi.");
  }

  function openPaymentModal(method: PaymentMethod) {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    if (appInfo.license.canCheckout === false) {
      pushToast("warning", "Bu abonelik durumunda checkout kapali.");
      return;
    }

    if (cart.length === 0) {
      pushToast("warning", "Sepet bos.");
      return;
    }

    if (shiftSummary?.requireOpenShift && !shiftSummary.activeSession) {
      pushToast("warning", "Once vardiya acilisi yapin.");
      setActiveModal("SHIFT");
      return;
    }

    setPaymentMethod(method);
    if (method === "CASH") {
      setCashReceived(totals.total.toFixed(2));
      setActiveModal("PAYMENT_CASH");
      return;
    }

    setCardConfirmed(false);
    setActiveModal("PAYMENT_CARD");
  }

  function closeModal() {
    setActiveModal("NONE");
    setMissingBarcode("");
  }

  async function completeSale(method: PaymentMethod) {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    if (appInfo.license.canCheckout === false) {
      pushToast("warning", "Bu abonelik durumunda checkout kapali.");
      return;
    }

    if (cart.length === 0) {
      pushToast("warning", "Sepette urun yok.");
      return;
    }

    if (method === "CARD" && !cardConfirmed) {
      pushToast("warning", "Kart odeme onayi gerekli.");
      return;
    }

    setIsCompleting(true);
    try {
      const customerLines = cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        lineTotal: calcLineTotal(line.qty, line.unitPrice, line.discount, line.taxRate)
      }));
      const customerTotal = totals.total;

      const result = await window.posApi.createSale({
        customerName: customerName.trim() || null,
        discount: headerDiscount,
        paymentMethod: method,
        lines: cart.map((line) => ({
          productId: line.productId,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          discount: Number(line.discount)
        }))
      });

      onSaleCompleted?.({
        saleId: result.saleId,
        receiptNo: result.receiptNo,
        total: result.total
      });

      setPaymentMethod(method);
      pushToast("success", "Satis tamamlandi.");
      if (result.printWarning) {
        pushToast("warning", result.printWarning);
      }
      if (result.fiscalWarning) {
        pushToast("warning", result.fiscalWarning);
      }

      await window.posApi.customerDisplayUpdate({
        state: "THANK_YOU",
        lines: customerLines,
        total: customerTotal
      });
      await window.posApi.clearCartDraft();
      setShowSaleCompleted(true);
      closeModal();
      window.setTimeout(() => {
        resetSaleDraft();
        setShowSaleCompleted(false);
        void window.posApi.customerDisplayUpdate({
          state: "ACTIVE",
          lines: [],
          total: 0
        });
      }, 1000);

      await Promise.all([refreshSync(), refreshShiftStatus(), refreshSummary()]);
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Satis sirasinda hata olustu.");
    } finally {
      setIsCompleting(false);
    }
  }

  function applyDiscount() {
    const value = Number(discountDraft);
    if (!Number.isFinite(value) || value < 0) {
      pushToast("warning", "Gecerli iskonto girin.");
      return;
    }
    setHeaderDiscount(round2(value));
    closeModal();
    pushToast("success", "Iskonto guncellendi.");
  }

  async function runSyncNow() {
    setIsSyncing(true);
    try {
      const next = await window.posApi.syncNow();
      setSyncStatus(next);
      setSyncDiagnostics(await window.posApi.getSyncDiagnostics());
      await refreshShiftStatus();
      if (next.failed > 0) {
        pushToast("warning", "Sync sorunlu, tekrar denenecek.");
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function retryDeadLetterNow() {
    setIsSyncing(true);
    try {
      const next = await window.posApi.retryDeadLetterSync();
      setSyncStatus(next);
      setSyncDiagnostics(await window.posApi.getSyncDiagnostics());
      pushToast("success", "Dead-letter olaylari tekrar kuyruga alindi.");
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Dead-letter retry basarisiz.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function openShiftFlow() {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    setIsSubmittingShift(true);
    try {
      await window.posApi.openShift({
        openingCash: parseAmountInput(openingShiftCash)
      });
      pushToast("success", "Vardiya acildi.");
      setActiveModal("NONE");
      await refreshShiftStatus();
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Vardiya acilamadi.");
    } finally {
      setIsSubmittingShift(false);
    }
  }

  async function recordCashAdjustmentFlow() {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    setIsRecordingCashAdjustment(true);
    try {
      await window.posApi.recordCashAdjustment({
        type: cashAdjustmentType,
        amount: parseAmountInput(cashAdjustmentAmount),
        reason: cashAdjustmentReason
      });
      pushToast("success", "Kasa hareketi kaydedildi.");
      setCashAdjustmentAmount("0.00");
      setCashAdjustmentReason("");
      setActiveModal("NONE");
      await Promise.all([refreshShiftStatus(), refreshSync()]);
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Kasa hareketi kaydedilemedi.");
    } finally {
      setIsRecordingCashAdjustment(false);
    }
  }

  function openRefundModal() {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    setRefundMode("RECEIPT");
    setRefundSearchValue("");
    setRefundCandidate(null);
    setRefundQtyByLineId({});
    setRefundDirectLines([]);
    setRefundPaymentMode("SAME_AS_ORIGINAL");
    setRefundReturnToStock(true);
    setRefundReasonCode("");
    setActiveModal("REFUND");
  }

  function switchRefundMode(nextMode: RefundMode) {
    if (nextMode === "DIRECT" && !appInfo.canManageCatalog) {
      pushToast("danger", "Direkt urun iadesi yetki gerektirir.");
      return;
    }
    setRefundMode(nextMode);
  }

  async function loadRefundSaleByReceipt() {
    const receiptNo = refundSearchValue.trim();
    if (receiptNo.length === 0) {
      pushToast("warning", "Fis no girin.");
      return;
    }

    setIsLoadingRefundSale(true);
    try {
      const sale = await window.posApi.getSaleByReceipt({ receiptNo });
      if (!sale) {
        setRefundCandidate(null);
        setRefundQtyByLineId({});
        pushToast("warning", "Fis bulunamadi.");
        return;
      }

      setRefundCandidate(sale);
      setRefundQtyByLineId(Object.fromEntries(sale.lines.map((line) => [line.saleLineId, line.qty])));
      pushToast("success", `${sale.receiptNo} fisi yuklendi.`);
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Fis sorgulanamadi.");
    } finally {
      setIsLoadingRefundSale(false);
    }
  }

  async function addDirectRefundProduct() {
    if (!appInfo.canManageCatalog) {
      pushToast("danger", "Direkt urun iadesi icin yetkili kullanici gerekli.");
      return;
    }

    const term = refundSearchValue.trim();
    if (term.length === 0) {
      pushToast("warning", "Barkod veya urun girin.");
      return;
    }

    const byBarcode = await window.posApi.listProducts({ barcode: term });
    const rows = byBarcode.length > 0 ? byBarcode : await window.posApi.listProducts({ search: term });
    if (rows.length === 0) {
      pushToast("warning", "Urun bulunamadi.");
      return;
    }

    const product = rows[0];
    setRefundDirectLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, qty: round2(line.qty + 1) } : line
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          taxRate: Number(product.taxRate ?? 0),
          qty: 1,
          unitPrice: Number(product.price ?? 0),
          discount: 0
        }
      ];
    });
    setRefundSearchValue("");
    pushToast("success", `${product.name} iade satirina eklendi.`);
  }

  function updateRefundQty(lineId: string, qty: number, maxQty: number) {
    const normalized = Math.max(0, Math.min(maxQty, Number.isFinite(qty) ? qty : 0));
    setRefundQtyByLineId((prev) => ({
      ...prev,
      [lineId]: round2(normalized)
    }));
  }

  function updateDirectRefundQty(productId: string, qty: number) {
    const normalized = Math.max(0, Number.isFinite(qty) ? qty : 0);
    setRefundDirectLines((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, qty: round2(normalized) } : line
      )
    );
  }

  function removeDirectRefundLine(productId: string) {
    setRefundDirectLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function completeRefund() {
    if (ensureOperationalWriteAllowed() === false) {
      return;
    }

    const lines =
      refundMode === "RECEIPT"
        ? selectedReceiptRefundLines.map((item) => ({
            sourceLineId: item.line.saleLineId,
            productId: item.line.productId,
            qty: item.qty,
            unitPrice: item.line.unitPrice,
            discount: item.discount,
            taxRate: item.line.taxRate
          }))
        : selectedDirectRefundLines.map((item) => ({
            productId: item.line.productId,
            qty: item.qty,
            unitPrice: item.line.unitPrice,
            discount: item.line.discount,
            taxRate: item.line.taxRate
          }));

    if (lines.length === 0) {
      pushToast("warning", "Iade satiri secin.");
      return;
    }

    if (refundMode === "RECEIPT" && !refundCandidate) {
      pushToast("warning", "Iade icin fis secin.");
      return;
    }

    setIsCreatingRefund(true);
    try {
      const result = await window.posApi.createRefund({
        sourceSaleId: refundMode === "RECEIPT" ? refundCandidate?.saleId : null,
        sourceReceiptNo: refundMode === "RECEIPT" ? refundCandidate?.receiptNo : null,
        paymentMode: refundPaymentMode,
        returnToStock: refundReturnToStock,
        refundReasonCode: refundReasonCode.trim() || null,
        lines
      });
      pushToast("success", `Iade tamamlandi: ${result.receiptNo}`);
      if (result.printWarning) {
        pushToast("warning", result.printWarning);
      }
      if (result.fiscalWarning) {
        pushToast("warning", result.fiscalWarning);
      }

      closeModal();
      await Promise.all([refreshSync(), refreshShiftStatus(), refreshSummary(dayEndDate)]);
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Iade islemi basarisiz.");
    } finally {
      setIsCreatingRefund(false);
    }
  }

  async function openDayEndModal() {
    if (!shiftSummary?.activeSession) {
      pushToast("warning", "Acik vardiya yok. Once vardiya acin.");
      setActiveModal("SHIFT");
      return;
    }
    setActiveModal("DAY_END");
    await Promise.all([refreshXReport(dayEndDate), refreshZPreview(dayEndDate, openingCash, countedCash)]);
  }

  async function printXReport() {
    setIsPrintingXReport(true);
    try {
      const result = await window.posApi.printXReport({ date: dayEndDate });
      setXReport(result.report);
      pushToast("success", "X raporu olusturuldu.");
      if (result.printWarning) {
        pushToast("warning", result.printWarning);
      }
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "X raporu yazdirilamadi.");
    } finally {
      setIsPrintingXReport(false);
    }
  }

  async function closeZReportFlow() {
    setIsClosingZReport(true);
    try {
      const result = await window.posApi.closeZReport({
        date: dayEndDate,
        openingCash: parseAmountInput(openingCash),
        countedCash: parseAmountInput(countedCash),
        cashierName: appInfo.cashierName
      });
      setZPreview(result.preview);
      pushToast("success", `Kasa kapatildi. Z raporu: ${shortId(result.reportId)}`);
      if (result.printWarning) {
        pushToast("warning", result.printWarning);
      }
      await Promise.all([refreshSummary(dayEndDate), refreshShiftStatus(), refreshSync()]);
      closeModal();
    } catch (error) {
      pushToast("danger", error instanceof Error ? error.message : "Kasa kapatma basarisiz.");
    } finally {
      setIsClosingZReport(false);
    }
  }

  const cashReceivedValue = Number(cashReceived);
  const changeAmount = Number.isFinite(cashReceivedValue) ? Math.max(0, cashReceivedValue - totals.total) : 0;

  return (
    <div className="pos-shell">
      <header className="status-bar">
        <div className="status-block">
          <span className="status-label">Sube</span>
          <strong>{appInfo.branchName}</strong>
        </div>
        <div className="status-block">
          <span className="status-label">Kasa</span>
          <strong>{appInfo.deviceName}</strong>
        </div>
        <div className="status-block">
          <span className="status-label">Kasiyer</span>
          <strong>{appInfo.cashierName}</strong>
          <span className="status-chip">{appInfo.cashierRole}</span>
        </div>
        <div className="status-block">
          <span className="status-label">Vardiya</span>
          <strong>{shiftLabel}</strong>
        </div>
        <div className="status-block status-block-online" title={syncWarningText}>
          <span className={`online-dot ${cloudOnline ? "online" : "offline"}`} />
          <strong>{cloudOnline ? "Online" : "Offline"}</strong>
          {pendingSyncCount > 0 ? <small>{syncWarningText}</small> : null}
        </div>
        <div className="status-clock">{clock.toLocaleString("tr-TR", { hour12: false })}</div>
      </header>

      {onboardingHint ? (
        <div className="onboarding-inline-hint" role="status">
          {onboardingHint}
        </div>
      ) : null}

      <main className="pos-main">
        <section className="surface left-panel">
          <div className="section-header">
            <h1>Ana Satis</h1>
            <div className="section-actions">
              <button className="btn-secondary" onClick={onOpenSettings}>
                Ayarlar
              </button>
              <button className="btn-secondary" onClick={() => void window.posApi.customerDisplayOpen()}>
                2. Ekran
              </button>
              <button className="btn-secondary" onClick={() => void onLogout()}>
                Cikis
              </button>
            </div>
          </div>

          <div className="barcode-row">
            <input
              ref={barcodeInputRef}
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleBarcodeEnter();
                }
              }}
              placeholder="Barkod okut ve Enter"
              aria-label="Barkod"
            />
            <button className="btn-primary" onClick={() => void handleBarcodeEnter()}>
              Ekle
            </button>
          </div>

          <div className="search-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchProducts();
                }
              }}
              placeholder="Urun ara (ad, SKU, barkod)"
              aria-label="Urun ara"
            />
            <button className="btn-secondary" onClick={() => void searchProducts()}>
              Ara
            </button>
          </div>

          <div className="cart-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Urun</th>
                  <th className="right">Miktar</th>
                  <th className="right">Birim</th>
                  <th className="right">Iskonto</th>
                  <th className="right">Toplam</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => {
                  const lineTotal = calcLineTotal(line.qty, line.unitPrice, line.discount, line.taxRate);
                  const isSelected = selectedLineId === line.productId;
                  const rowClass = [isSelected ? "is-selected" : "", addedLineId === line.productId ? "cart-row-added" : ""]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={line.productId} className={rowClass} onClick={() => setSelectedLineId(line.productId)}>
                      <td>
                        <strong className="line-name">{line.name}</strong>
                      </td>
                      <td className="right">
                        <div className="qty-controls">
                          <button className="qty-btn" onClick={() => changeLineQty(line.productId, -1)}>
                            -
                          </button>
                          <span>{fmtNumber(line.qty)}</span>
                          <button className="qty-btn" onClick={() => changeLineQty(line.productId, 1)}>
                            +
                          </button>
                        </div>
                      </td>
                      <td className="right">{fmtMoney(line.unitPrice)}</td>
                      <td className="right">{fmtMoney(line.discount)}</td>
                      <td className="right line-total">{fmtMoney(lineTotal)}</td>
                      <td className="right">
                        <button className="btn-danger btn-small" onClick={() => removeLine(line.productId)}>
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Sepet bos. Barkod okutun veya urun arayin.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="quick-product-list">
            {products.slice(0, 8).map((product) => (
              <button key={product.id} className="quick-product" onClick={() => addToCart(product)}>
                <span>{product.name}</span>
                <strong>{fmtMoney(Number(product.price ?? 0))}</strong>
              </button>
            ))}
          </div>
        </section>

        <aside className="surface right-panel">
          <section className="summary-card">
            <h2>Ozet</h2>
            <div className="summary-grid">
              <span>Ara Toplam</span>
              <strong>{fmtMoney(totals.subtotal)}</strong>
              <span>Iskonto</span>
              <strong>{fmtMoney(totals.discount)}</strong>
              <span>Vergi</span>
              <strong>{fmtMoney(totals.tax)}</strong>
            </div>
            <div className="grand-total">
              <span>GENEL TOPLAM</span>
              <strong>{fmtMoney(totals.total)}</strong>
            </div>
          </section>

          <section className="payment-actions">
            <button className="cta-button cash" disabled={isCompleting || writeLocked || appInfo.license.canCheckout === false} onClick={() => openPaymentModal("CASH")}>
              NAKIT (F9)
            </button>
            <button className="cta-button card" disabled={isCompleting || writeLocked || appInfo.license.canCheckout === false} onClick={() => openPaymentModal("CARD")}>
              KART (F10)
            </button>
            <small>Enter: varsayilan odeme ({paymentMethod === "CASH" ? "Nakit" : "Kart"})</small>
          </section>

          <section className="info-card">
            <div className="info-header">
              <h3>Vardiya</h3>
              <button className="btn-secondary btn-small" onClick={() => setActiveModal("SHIFT")} disabled={writeLocked}>
                {activeShift ? "Yonet" : "Ac"}
              </button>
            </div>
            <p className={activeShift ? "status-ok" : "status-warn"}>
              {activeShift ? "Kasa oturumu acik" : "Kasa oturumu kapali"}
            </p>
            <p className="muted-text">
              {activeShift
                ? `Acilis: ${fmtMoney(activeShift.openingCashAmount)}`
                : "Satistan once vardiya acilisi onerilir."}
            </p>
            {shiftSummary?.report ? (
              <p className="muted-text">
                Beklenen kasa: {fmtMoney(shiftSummary.report.expectedCash)} | Islem: {shiftSummary.report.transactionCount}
              </p>
            ) : null}
          </section>

          <section className="info-card">
            <div className="info-header">
              <h3>Senkron</h3>
              <div className="inline-actions">
                <button className="btn-secondary btn-small" onClick={() => setActiveModal("DIAGNOSTICS")}>
                  Tani
                </button>
                <button className="btn-secondary btn-small" onClick={() => void runSyncNow()} disabled={isSyncing}>
                  {isSyncing ? "Sync..." : "Simdi"}
                </button>
              </div>
            </div>
            <p className={cloudOnline ? "status-ok" : "status-warn"}>
              {cloudOnline ? "Online ve senkron aktif" : "Baglanti sorunlu, kasa calismaya devam eder"}
            </p>
            <p className="muted-text">
              Pending: {pendingSyncCount} | Failed: {failedSyncCount}
            </p>
            <p className="muted-text">
              Last Sync: {syncDiagnostics?.lastSuccessfulSyncAt ? new Date(syncDiagnostics.lastSuccessfulSyncAt).toLocaleString("tr-TR") : "never"}
            </p>
            <p className={`sync-health sync-health-${syncHealth}`}>Health: {syncHealthLabel}</p>
            {syncStatus?.blockedReason ? <p className="status-warn">{syncStatus.blockedReason}</p> : null}
          </section>

          <section className="info-card">
            <div className="info-header">
              <h3>Kasa Hareketi</h3>
              <button className="btn-secondary btn-small" onClick={() => setActiveModal("CASH_ADJUSTMENT")} disabled={writeLocked}>
                Ekle
              </button>
            </div>
            <p className="muted-text">
              Nakit giris/cikis ve duzeltme kayitlari vardiya mutabakatina dahil edilir.
            </p>
            {shiftSummary?.report ? (
              <p className="muted-text">Net kasa etkisi: {fmtMoney(shiftSummary.report.cashAdjustmentNet)}</p>
            ) : null}
          </section>

          <section className="info-card">
            <div className="info-header">
              <h3>Lisans</h3>
              <button className="btn-secondary btn-small" onClick={() => void refreshSync()}>
                Yenile
              </button>
            </div>
            <p className={writeLocked ? "status-warn" : "status-ok"}>
              Durum: {lifecycle.label}
            </p>
            <p className="muted-text">{lifecycle.message}</p>
            <p className="muted-text">
              Plan: {(appInfo.license.planCode ?? "-").toUpperCase()} | Cihaz: {appInfo.license.activeDevices ?? 0}
              {appInfo.license.maxDevices ? " / " + appInfo.license.maxDevices : " / limitsiz"}
            </p>
            <p className="muted-text">
              Bitis: {appInfo.license.expiresAt ? new Date(appInfo.license.expiresAt).toLocaleDateString("tr-TR") : "-"}
              {lifecycle.daysRemaining !== null ? " (" + lifecycle.daysRemaining + " gun)" : ""}
            </p>
            <p className="muted-text">Acik: {lifecycle.allowedActions.join(" • ")}</p>
            <p className="muted-text">Kapali: {lifecycle.blockedActions.join(" • ")}</p>
            <p className="status-warn">Sonraki adim: {lifecycle.nextAction}</p>
            {lifecycle.state === "trial_expiring" || lifecycle.state === "trial_expired" || appInfo.license.requiresUpgradeAction ? (
              <p className="status-warn">Yukseltme aksiyonu: Web portal / Abonelik. Indirme tek basina lisans acmaz.</p>
            ) : null}
          </section>

          <section className="info-card">
            <div className="info-header">
              <h3>Gun Sonu Ozeti</h3>
              <input
                type="date"
                value={reportDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setReportDate(nextDate);
                  void refreshSummary(nextDate);
                }}
              />
            </div>
            {reportSummary ? (
              <div className="report-grid">
                <span>Satis adedi</span>
                <strong>{reportSummary.saleCount}</strong>
                <span>Net toplam</span>
                <strong>{fmtMoney(reportSummary.netTotal)}</strong>
                <span>Vergi</span>
                <strong>{fmtMoney(reportSummary.taxTotal)}</strong>
              </div>
            ) : (
              <p className="muted-text">Rapor hazirlaniyor...</p>
            )}
            <div className="inline-actions">
              <button className="btn-primary btn-small" onClick={() => void openDayEndModal()}>
                F7 Gun Sonu
              </button>
            </div>
          </section>
        </aside>
      </main>

      <footer className="hotkey-bar">
        <button className="hotkey-button" onClick={startNewSale}>
          <strong>F1</strong>
          <span>Yeni Satis</span>
        </button>
        <button className="hotkey-button" onClick={openRefundModal} disabled={writeLocked}>
          <strong>F2</strong>
          <span>Iade</span>
        </button>
        <button className="hotkey-button" onClick={() => { setDiscountDraft(headerDiscount.toFixed(2)); setActiveModal("DISCOUNT"); }}>
          <strong>F3</strong>
          <span>Iskonto</span>
        </button>
        <button className="hotkey-button" onClick={() => setActiveModal("CUSTOMER")}>
          <strong>F4</strong>
          <span>Musteri</span>
        </button>
        <button className="hotkey-button" onClick={() => setActiveModal("SHIFT")} disabled={writeLocked}>
          <strong>F5</strong>
          <span>Vardiya</span>
        </button>
        <button className="hotkey-button" onClick={() => setActiveModal("CASH_ADJUSTMENT")} disabled={writeLocked}>
          <strong>F6</strong>
          <span>Kasa Hareketi</span>
        </button>
        <button className="hotkey-button" onClick={() => void openDayEndModal()}>
          <strong>F7</strong>
          <span>Gun Sonu</span>
        </button>
        <button className="hotkey-button" onClick={() => setActiveModal("DIAGNOSTICS")}>
          <strong>F8</strong>
          <span>Diagnostics</span>
        </button>
      </footer>

      {showSaleCompleted ? (
        <div className="sale-complete-overlay" role="status" aria-live="polite">
          <div className="sale-complete-card">✓ Satis Tamamlandi</div>
        </div>
      ) : null}

      {activeModal !== "NONE" ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true">
            {activeModal === "PAYMENT_CASH" ? (
              <>
                <h2>Nakit Odeme</h2>
                <label htmlFor="cash-received">Alinan tutar</label>
                <input
                  id="cash-received"
                  type="number"
                  min={0}
                  step={0.01}
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  autoFocus
                />
                <div className="modal-summary">
                  <span>Toplam</span>
                  <strong>{fmtMoney(totals.total)}</strong>
                  <span>Para Ustu</span>
                  <strong>{fmtMoney(changeAmount)}</strong>
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Vazgec</button>
                  <button className="btn-primary" onClick={() => void completeSale("CASH")} disabled={isCompleting || writeLocked || appInfo.license.canCheckout === false}>
                    {isCompleting ? "Tamamlaniyor..." : "Satisi Tamamla"}
                  </button>
                </div>
              </>
            ) : null}

            {activeModal === "PAYMENT_CARD" ? (
              <>
                <h2>Kart Odeme</h2>
                <div className="modal-summary">
                  <span>Tutar</span>
                  <strong>{fmtMoney(totals.total)}</strong>
                </div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={cardConfirmed} onChange={(event) => setCardConfirmed(event.target.checked)} autoFocus />
                  POS cihazindan cekim onayi alindi
                </label>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Vazgec</button>
                  <button className="btn-primary" onClick={() => void completeSale("CARD")} disabled={isCompleting || writeLocked || appInfo.license.canCheckout === false || !cardConfirmed}>
                    {isCompleting ? "Tamamlaniyor..." : "Satisi Tamamla"}
                  </button>
                </div>
              </>
            ) : null}

            {activeModal === "PRODUCT_NOT_FOUND" ? (
              <>
                <h2>Urun bulunamadi</h2>
                <p>Barkod: {missingBarcode}</p>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat</button>
                  {appInfo.canManageCatalog ? <button className="btn-primary" onClick={closeModal}>Urun ekle</button> : null}
                </div>
              </>
            ) : null}

            {activeModal === "REFUND" ? (
              <>
                <h2>IADE EKRANI</h2>
                <div className="segmented">
                  <button className={refundMode === "RECEIPT" ? "is-active" : ""} onClick={() => switchRefundMode("RECEIPT")}>Fis Uzerinden</button>
                  <button className={refundMode === "DIRECT" ? "is-active" : ""} onClick={() => switchRefundMode("DIRECT")}>Direkt Urun</button>
                </div>

                <div className="refund-search-row">
                  <input
                    ref={refundInputRef}
                    value={refundSearchValue}
                    onChange={(event) => setRefundSearchValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (refundMode === "RECEIPT") {
                          void loadRefundSaleByReceipt();
                        } else {
                          void addDirectRefundProduct();
                        }
                      }
                    }}
                    placeholder={refundMode === "RECEIPT" ? "Fis No girin" : "Barkod / urun ara"}
                  />
                  <button className="btn-primary" onClick={() => refundMode === "RECEIPT" ? void loadRefundSaleByReceipt() : void addDirectRefundProduct()} disabled={isLoadingRefundSale || isCreatingRefund}>
                    {refundMode === "RECEIPT" ? "Fis Getir" : "Ekle"}
                  </button>
                </div>

                {refundMode === "RECEIPT" ? (
                  <div className="modal-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Urun</th>
                          <th className="right">Miktar</th>
                          <th className="right">Fiyat</th>
                          <th className="right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {refundCandidate?.lines.map((line) => {
                          const currentQty = Number(refundQtyByLineId[line.saleLineId] ?? 0);
                          const normalizedQty = Math.max(0, Math.min(line.qty, currentQty));
                          const proportionalDiscount = line.qty > 0 ? round2((line.discount * normalizedQty) / line.qty) : 0;
                          const lineTotal = calcLineTotal(normalizedQty, line.unitPrice, proportionalDiscount, line.taxRate);
                          return (
                            <tr key={line.saleLineId}>
                              <td>{line.productName}</td>
                              <td className="right">
                                <input className="inline-number-input" type="number" min={0} max={line.qty} step={0.001} value={normalizedQty} onChange={(event) => updateRefundQty(line.saleLineId, Number(event.target.value), line.qty)} />
                              </td>
                              <td className="right">{fmtMoney(line.unitPrice)}</td>
                              <td className="right">{fmtMoney(lineTotal)}</td>
                            </tr>
                          );
                        })}
                        {!refundCandidate ? (
                          <tr><td colSpan={4} className="empty-state">Iade icin fis numarasi girin.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="modal-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Urun</th>
                          <th className="right">Miktar</th>
                          <th className="right">Fiyat</th>
                          <th className="right">Toplam</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {refundDirectLines.map((line) => (
                          <tr key={line.productId}>
                            <td>{line.name}</td>
                            <td className="right">
                              <input className="inline-number-input" type="number" min={0} step={0.001} value={line.qty} onChange={(event) => updateDirectRefundQty(line.productId, Number(event.target.value))} />
                            </td>
                            <td className="right">{fmtMoney(line.unitPrice)}</td>
                            <td className="right">{fmtMoney(calcLineTotal(line.qty, line.unitPrice, line.discount, line.taxRate))}</td>
                            <td className="right">
                              <button className="btn-danger btn-small" onClick={() => removeDirectRefundLine(line.productId)}>Sil</button>
                            </td>
                          </tr>
                        ))}
                        {refundDirectLines.length === 0 ? (
                          <tr><td colSpan={5} className="empty-state">Barkod/urun ile iade satiri ekleyin.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}

                <fieldset className="radio-group">
                  <legend>Odeme Turu</legend>
                  <label><input type="radio" checked={refundPaymentMode === "CASH"} onChange={() => setRefundPaymentMode("CASH")} /> Nakit</label>
                  <label><input type="radio" checked={refundPaymentMode === "CARD"} onChange={() => setRefundPaymentMode("CARD")} /> Kart</label>
                  <label><input type="radio" checked={refundPaymentMode === "SAME_AS_ORIGINAL"} onChange={() => setRefundPaymentMode("SAME_AS_ORIGINAL")} /> Ayni odeme yontemi</label>
                </fieldset>

                <label className="checkbox-row">
                  <input type="checkbox" checked={refundReturnToStock} onChange={(event) => setRefundReturnToStock(event.target.checked)} />
                  Iade stoklara geri donsun
                </label>
                <label>
                  Iade nedeni
                  <input value={refundReasonCode} onChange={(event) => setRefundReasonCode(event.target.value)} placeholder="urun_hatasi / musteri_iadesi" />
                </label>

                <div className="modal-summary">
                  <span>TOPLAM IADE</span>
                  <strong>{fmtMoney(refundTotal)}</strong>
                </div>

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat (ESC)</button>
                  <button className="btn-danger" onClick={() => void completeRefund()} disabled={isCreatingRefund || refundTotal <= 0}>
                    {isCreatingRefund ? "Tamamlaniyor..." : "IADE TAMAMLA"}
                  </button>
                </div>
              </>
            ) : null}

            {activeModal === "DAY_END" ? (
              <>
                <h2>GUN SONU (X / Z RAPORU)</h2>
                <div className="day-end-header">
                  <label htmlFor="day-end-date">Tarih</label>
                  <input id="day-end-date" type="date" value={dayEndDate} onChange={(event) => { const nextDate = event.target.value; setDayEndDate(nextDate); void refreshXReport(nextDate); }} />
                </div>

                <section className="report-panel">
                  <div className="panel-head">
                    <h3>X RAPORU</h3>
                    <button className="btn-primary btn-small" onClick={() => void printXReport()} disabled={isPrintingXReport}>
                      {isPrintingXReport ? "Yazdiriliyor..." : "Yazdir"}
                    </button>
                  </div>
                  {isLoadingXReport ? <p className="muted-text">X raporu yukleniyor...</p> : null}
                  {xReport ? (
                    <div className="report-grid">
                      <span>Toplam Satis</span><strong>{fmtMoney(xReport.totalSales)}</strong>
                      <span>Nakit</span><strong>{fmtMoney(xReport.cashSales)}</strong>
                      <span>Kart</span><strong>{fmtMoney(xReport.cardSales)}</strong>
                      <span>Toplam Islem</span><strong>{xReport.transactionCount}</strong>
                      <span>Iade</span><strong>{fmtMoney(xReport.refundTotal)}</strong>
                    </div>
                  ) : null}
                </section>

                <section className="report-panel">
                  <div className="panel-head">
                    <h3>Z RAPORU</h3>
                    <button className="btn-danger btn-small" onClick={() => void closeZReportFlow()} disabled={isClosingZReport}>
                      {isClosingZReport ? "Kapatiliyor..." : "KASAYI KAPAT"}
                    </button>
                  </div>
                  <div className="z-grid">
                    <span>Kasiyer</span><strong>{appInfo.cashierName}</strong>
                    <span>Acilis</span>
                    <input type="number" min={0} step={0.01} value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
                    <span>Nakit satis</span><strong>{fmtMoney(zPreview?.cashSales ?? 0)}</strong>
                    <span>Kart satis</span><strong>{fmtMoney(zPreview?.cardSales ?? 0)}</strong>
                    <span>Iade</span><strong>{fmtMoney(zPreview?.refundTotal ?? 0)}</strong>
                    <span>Beklenen kasa</span><strong>{fmtMoney(zPreview?.expectedCash ?? 0)}</strong>
                    <span>Girilen kasa</span>
                    <input type="number" min={0} step={0.01} value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
                    <span>Fark</span>
                    <strong className={Math.abs(zPreview?.difference ?? 0) > 0.0001 ? "status-warn" : "status-ok"}>{fmtMoney(zPreview?.difference ?? 0)}</strong>
                  </div>
                </section>

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat (ESC)</button>
                </div>
              </>
            ) : null}

            {activeModal === "SHIFT" ? (
              <>
                <h2>VARDIYA / KASA OTURUMU</h2>
                {activeShift ? (
                  <>
                    <div className="report-grid">
                      <span>Durum</span><strong>Acik</strong>
                      <span>Acilis</span><strong>{fmtMoney(activeShift.openingCashAmount)}</strong>
                      <span>Acilis saati</span><strong>{new Date(activeShift.openedAt).toLocaleString("tr-TR")}</strong>
                      <span>Beklenen kasa</span><strong>{fmtMoney(shiftSummary?.report?.expectedCash ?? 0)}</strong>
                    </div>
                    <p className="muted-text">Kapatma islemi gun sonu panelinden Z raporu ile tamamlanir.</p>
                  </>
                ) : (
                  <>
                    <label htmlFor="opening-shift-cash">Acilis nakdi</label>
                    <input
                      id="opening-shift-cash"
                      type="number"
                      min={0}
                      step={0.01}
                      value={openingShiftCash}
                      onChange={(event) => setOpeningShiftCash(event.target.value)}
                      autoFocus
                    />
                    <p className="muted-text">Vardiya acildiginda satislar ve kasa hareketleri bu oturuma baglanir.</p>
                  </>
                )}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat</button>
                  {!activeShift ? (
                    <button className="btn-primary" onClick={() => void openShiftFlow()} disabled={isSubmittingShift}>
                      {isSubmittingShift ? "Aciliyor..." : "Vardiyayi Ac"}
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={() => { closeModal(); void openDayEndModal(); }}>
                      Gun Sonuna Git
                    </button>
                  )}
                </div>
              </>
            ) : null}

            {activeModal === "CASH_ADJUSTMENT" ? (
              <>
                <h2>KASA HAREKETI</h2>
                <fieldset className="radio-group">
                  <legend>Hareket tipi</legend>
                  <label><input type="radio" checked={cashAdjustmentType === "cash_in"} onChange={() => setCashAdjustmentType("cash_in")} /> Nakit Giris</label>
                  <label><input type="radio" checked={cashAdjustmentType === "cash_out"} onChange={() => setCashAdjustmentType("cash_out")} /> Nakit Cikis</label>
                  <label><input type="radio" checked={cashAdjustmentType === "correction"} onChange={() => setCashAdjustmentType("correction")} /> Duzeltme</label>
                </fieldset>
                <label htmlFor="cash-adjustment-amount">Tutar</label>
                <input
                  id="cash-adjustment-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={cashAdjustmentAmount}
                  onChange={(event) => setCashAdjustmentAmount(event.target.value)}
                  autoFocus
                />
                <label htmlFor="cash-adjustment-reason">Aciklama</label>
                <textarea
                  id="cash-adjustment-reason"
                  value={cashAdjustmentReason}
                  onChange={(event) => setCashAdjustmentReason(event.target.value)}
                  placeholder="Kasa cikis nedeni"
                />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat</button>
                  <button className="btn-primary" onClick={() => void recordCashAdjustmentFlow()} disabled={isRecordingCashAdjustment}>
                    {isRecordingCashAdjustment ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </>
            ) : null}

            {activeModal === "DIAGNOSTICS" ? (
              <>
                <h2>SENKRON TANI PANELI</h2>
                <div className="report-grid">
                  <span>Baglanti</span><strong>{syncStatus?.connectionQuality ?? "-"}</strong>
                  <span>Health</span><strong>{syncHealthLabel}</strong>
                  <span>Bekleyen</span><strong>{pendingSyncCount}</strong>
                  <span>Hatali</span><strong>{failedSyncCount}</strong>
                  <span>Dead-letter</span><strong>{syncStatus?.deadLetter ?? 0}</strong>
                  <span>En eski hata</span><strong>{syncStatus?.oldestFailedAt ? new Date(syncStatus.oldestFailedAt).toLocaleString("tr-TR") : "-"}</strong>
                  <span>Son push</span><strong>{syncDiagnostics?.lastSuccessfulSyncAt ? new Date(syncDiagnostics.lastSuccessfulSyncAt).toLocaleString("tr-TR") : "-"}</strong>
                  <span>Son pull</span><strong>{syncStatus?.lastPullAt ? new Date(syncStatus.lastPullAt).toLocaleString("tr-TR") : "-"}</strong>
                  <span>Heartbeat</span><strong>{syncStatus?.lastHeartbeatAt ? new Date(syncStatus.lastHeartbeatAt).toLocaleString("tr-TR") : "-"}</strong>
                </div>
                {syncStatus?.lastError ? <p className="status-warn">{syncStatus.lastError}</p> : null}
                {syncStatus?.blockedReason ? <p className="status-warn">{syncStatus.blockedReason}</p> : null}
                {syncStatus?.failedReasons?.length ? (
                  <ul className="status-list">
                    {syncStatus.failedReasons.map((reason) => (
                      <li key={reason.errorCode}>
                        <strong>{reason.errorCode}</strong> ({reason.count})
                        {reason.sampleMessage ? ' - ' + reason.sampleMessage : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat</button>
                  <button className="btn-secondary" onClick={() => void runSyncNow()} disabled={isSyncing}>
                    {isSyncing ? "Sync..." : "Simdi Sync"}
                  </button>
                  <button className="btn-primary" onClick={() => void retryDeadLetterNow()} disabled={isSyncing}>
                    Dead-letter Retry
                  </button>
                </div>
              </>
            ) : null}

            {activeModal === "DISCOUNT" ? (
              <>
                <h2>Toplam Iskonto</h2>
                <label htmlFor="discount-input">Iskonto tutari</label>
                <input id="discount-input" type="number" min={0} step={0.01} value={discountDraft} onChange={(event) => setDiscountDraft(event.target.value)} autoFocus />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Vazgec</button>
                  <button className="btn-primary" onClick={applyDiscount}>Uygula</button>
                </div>
              </>
            ) : null}

            {activeModal === "CUSTOMER" ? (
              <>
                <h2>Musteri Secimi</h2>
                <label htmlFor="customer-input">Musteri adi</label>
                <input id="customer-input" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Musteri arama v1.1" autoFocus />
                <p className="muted-text">Musteri secimi sonraki asamada cari modulu ile baglanacak.</p>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={closeModal}>Kapat</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? <div className={`toast ${toast.kind}`}>{toast.message}</div> : null}

      <div className="meta-footer">
        Tenant: {shortId(appInfo.tenantId)} | Branch: {shortId(appInfo.branchId)} | Device: {shortId(appInfo.deviceId)}
      </div>
    </div>
  );
}
