"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getStoredSession } from "@/lib/auth";
import { getCustomerPortalSnapshot } from "@/lib/commerce-state";
import { loadCustomerPortalExperience, type TrialLifecycleState } from "@/lib/portal-service";

type BillingCycle = "monthly" | "yearly";
type PricingContext = "guest" | "customer" | "trial" | "reseller";

const portalSubscriptionRoute = "/portal/subscription";

const canonicalLifecycleStates: TrialLifecycleState[] = [
  "trial_active",
  "trial_expiring",
  "trial_expired",
  "subscription_active",
  "subscription_past_due",
  "subscription_canceled",
  "suspended_blocked"
];

function normalizeLifecycleState(rawState: string | null | undefined, subscriptionStatus?: string | null): TrialLifecycleState {
  const normalized = (rawState ?? "").trim().toLowerCase();
  if ((canonicalLifecycleStates as string[]).includes(normalized)) {
    return normalized as TrialLifecycleState;
  }

  if (normalized === "trial_expiring_soon") {
    return "trial_expiring";
  }

  if (normalized === "trial_expired_read_only") {
    return "trial_expired";
  }

  if (normalized === "past_due" || normalized === "past-due") {
    return "subscription_past_due";
  }

  if (normalized === "canceled" || normalized === "cancelled") {
    return "subscription_canceled";
  }

  if (normalized === "suspended" || normalized === "blocked") {
    return "suspended_blocked";
  }

  const sub = (subscriptionStatus ?? "").toLowerCase();
  if (sub === "trialing") {
    return "trial_active";
  }
  if (sub === "past_due") {
    return "subscription_past_due";
  }
  if (sub === "canceled" || sub === "cancelled") {
    return "subscription_canceled";
  }

  return "subscription_active";
}

function buildLifecycleMessage(state: TrialLifecycleState, daysRemaining: number | null): string | null {
  if (state === "trial_active") {
    return daysRemaining == null
      ? "Deneme aktif. Deneme bitmeden yukselterek kesintisiz devam edin."
      : `Deneme aktif (${daysRemaining} gun kaldi). Deneme bitmeden yukseltin.`;
  }

  if (state === "trial_expiring") {
    return daysRemaining == null
      ? "Deneme bitmek uzere. Sure sonunda sistem salt-okunur moda gecer."
      : `Deneme bitmek uzere (${daysRemaining} gun). Sure sonunda sistem salt-okunur moda gecer.`;
  }

  if (state === "trial_expired") {
    return "Deneme suresi bitti. Sistem salt-okunur modda; goruntuleme acik, operasyon yazma akislari kapali.";
  }

  if (state === "subscription_past_due") {
    return "Odeme gecikmis. Kesinti olmamasi icin portal abonelik adimindan odeme/yenileme durumunu guncelleyin.";
  }

  if (state === "subscription_canceled") {
    return "Abonelik iptal durumunda. Donem sonu kesintisi olmamasi icin aboneligi yeniden etkinlestirin.";
  }

  if (state === "suspended_blocked") {
    return "Hesap askida/bloklu. Operasyon yazma akislarini acmak icin abonelik/lisans durumunu portalden duzeltin.";
  }

  return null;
}

interface PlanViewModel {
  code: "starter" | "pro" | "enterprise";
  name: string;
  badge?: string;
  target: string;
  valueLine: string;
  monthlyPrice?: number;
  yearlyMonthlyPrice?: number;
  bullets: string[];
  limits: {
    devices: string;
    branches: string;
    staff: string;
  };
  enterprise?: boolean;
}

const plans: PlanViewModel[] = [
  {
    code: "starter",
    name: "Starter",
    target: "Tek sube / yeni baslayan isletme",
    valueLine: "Kasada hizli baslangic icin gerekli tum cekirdekler",
    monthlyPrice: 1490,
    yearlyMonthlyPrice: 1190,
    bullets: [
      "Hizli satis ve temel stok akisi",
      "Sinirli e-fatura ve tahsilat destegi",
      "Gun sonu raporlari ile net ozet",
      "Kurulum adimlari rehberli ve basit"
    ],
    limits: {
      devices: "2 cihaz",
      branches: "1 sube",
      staff: "5 personel"
    }
  },
  {
    code: "pro",
    name: "Growth",
    badge: "En Populer",
    target: "Buyuyen isletme / cok kasali operasyon",
    valueLine: "Gercek isletme yonetimi burada baslar",
    monthlyPrice: 2990,
    yearlyMonthlyPrice: 2390,
    bullets: [
      "Coklu sube yonetimi ve gelismis raporlar",
      "Online tahsilat ve e-fatura kapasitesi artar",
      "Roller, cihazlar ve ekip kontrolu netlesir",
      "Yukseltmelerde veri kaybi yasamazsiniz"
    ],
    limits: {
      devices: "8 cihaz",
      branches: "4 sube",
      staff: "25 personel"
    }
  },
  {
    code: "enterprise",
    name: "Enterprise",
    target: "Zincir / kurumsal",
    valueLine: "Sistem degil, buyume altyapisi",
    bullets: [
      "Sinirsiza yakin olceklenebilir operasyon modeli",
      "Kuruma ozel rollout ve aktivasyon plani",
      "Oncelikli destek ve teknik mimari eslesmesi",
      "Coklu ekip ve birimlere ozel yonetim katmani"
    ],
    limits: {
      devices: "Ozel",
      branches: "Ozel",
      staff: "Ozel"
    },
    enterprise: true
  }
];

const comparisonRows = [
  { label: "Cihaz limiti", starter: "2", growth: "8", enterprise: "Ozel" },
  { label: "Sube limiti", starter: "1", growth: "4", enterprise: "Sinirsiza yakin" },
  { label: "E-fatura", starter: "Sinirli", growth: "Tam", enterprise: "Tam + ozel akis" },
  { label: "Online tahsilat", starter: "Sinirli", growth: "Tam", enterprise: "Tam + ozel kural" },
  { label: "Gelismis rapor", starter: "-", growth: "Var", enterprise: "Var + ozel raporlar" },
  { label: "Destek seviyesi", starter: "Standart", growth: "Oncelikli", enterprise: "Kurumsal SLA" }
] as const;

const pricingFaq = [
  {
    question: "Deneme nasil calisiyor?",
    answer:
      "14 gun boyunca tam urun akisini test edersiniz. Deneme sonunda plani secip lisansi aktif ederek kesintisiz devam edebilirsiniz."
  },
  {
    question: "Kredi karti gerekiyor mu?",
    answer: "Hayir. Denemeyi kredi karti olmadan baslatabilirsiniz."
  },
  {
    question: "Iptal edebilir miyim?",
    answer: "Evet. Planinizi istediginiz zaman iptal edebilirsiniz."
  },
  {
    question: "Lisans nasil aktif edilir?",
    answer:
      "Plan seciminden sonra lisans aninda olusur. Aktivasyon tamamlandiginda satis/odeme Desktop POS tarafinda, Mobile ise operasyon takip/kontrol akisinda kullanilir."
  },
  {
    question: "Plan degistirince ne olur?",
    answer:
      "Yukseltme aninda devreye girer. Veri kaybi olmaz, mevcut cihaz ve kayitlar korunur."
  },
  {
    question: "Ek cihaz nasil eklenir?",
    answer: "Planinizi yukseltin veya ek paket tanimlayin; yeni cihazlar hemen aktif edilebilir."
  }
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(value);
}

function getPrimaryAction(context: PricingContext, lifecycleState: TrialLifecycleState | null) {
  if (context === "reseller") {
    return { label: "Bayi Portalina Git", href: "/reseller/portal" };
  }

  if (context === "guest") {
    return { label: "Plani Sec", href: "#plan-kartlari" };
  }

  switch (lifecycleState) {
    case "trial_active":
    case "trial_expiring":
      return { label: "Upgrade", href: portalSubscriptionRoute };
    case "trial_expired":
      return { label: "Renew / Upgrade", href: portalSubscriptionRoute };
    case "subscription_past_due":
      return { label: "Pay / Renew", href: portalSubscriptionRoute };
    case "subscription_canceled":
      return { label: "Reactivate / Renew", href: portalSubscriptionRoute };
    case "suspended_blocked":
      return { label: "Aboneligi Coz", href: portalSubscriptionRoute };
    default:
      return { label: "Manage Plan", href: portalSubscriptionRoute };
  }
}

function getSecondaryAction(context: PricingContext) {
  if (context === "customer") {
    return { label: "Portalimi Ac", href: "/portal" };
  }

  if (context === "reseller") {
    return { label: "Bayi Girisi", href: "/reseller/login" };
  }

  return { label: "Ucretsiz Deneme", href: "/register" };
}

function getCardCta(context: PricingContext) {
  if (context === "trial") {
    return "Simdi Yukselt";
  }

  if (context === "customer") {
    return "Plani Yukselt";
  }

  if (context === "reseller") {
    return "Bayi Fiyatina Gec";
  }

  return "Plani Sec";
}

export function PricingConversionPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [expandedComparison, setExpandedComparison] = useState(false);
  const [pricingContext, setPricingContext] = useState<PricingContext>("guest");
  const [portalLifecycleState, setPortalLifecycleState] =
    useState<TrialLifecycleState | null>(null);
  const [trialStatusMessage, setTrialStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const session = getStoredSession();

      if (!session) {
        if (cancelled) {
          return;
        }
        setPricingContext("guest");
        setPortalLifecycleState(null);
        setTrialStatusMessage(null);
        return;
      }

      if (session.portalType === "reseller") {
        if (cancelled) {
          return;
        }
        setPricingContext("reseller");
        setPortalLifecycleState(null);
        setTrialStatusMessage(null);
        return;
      }

      if (session.portalType === "customer") {
        try {
          const experience = await loadCustomerPortalExperience();
          if (!experience) {
            if (cancelled) {
              return;
            }
            setPortalLifecycleState("subscription_active");
            setPricingContext("customer");
            setTrialStatusMessage(null);
            return;
          }

          const lifecycleState = normalizeLifecycleState(
            experience.promo.lifecycleState,
            experience.subscription?.status
          );
          const trialDays = experience.promo.trialRemainingDays ?? null;
          if (cancelled) {
            return;
          }

          setPortalLifecycleState(lifecycleState);
          setPricingContext(
            lifecycleState === "trial_active" ||
              lifecycleState === "trial_expiring" ||
              lifecycleState === "trial_expired"
              ? "trial"
              : "customer"
          );
          setTrialStatusMessage(buildLifecycleMessage(lifecycleState, trialDays));
          return;
        } catch {
          const snapshot = getCustomerPortalSnapshot();
          const trialing = snapshot?.subscription?.status === "trialing";
          const trialEndRaw = snapshot?.subscription?.currentPeriodEnd;
          const trialEnd = trialEndRaw ? new Date(trialEndRaw) : null;
          const now = new Date();
          const remainingDays = trialEnd
            ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
            : null;

          const lifecycleState = trialing
            ? remainingDays !== null && remainingDays <= 0
              ? "trial_expired"
              : remainingDays !== null && remainingDays <= 3
              ? "trial_expiring"
              : "trial_active"
            : "subscription_active";

          if (cancelled) {
            return;
          }

          setPortalLifecycleState(lifecycleState);
          setPricingContext(trialing ? "trial" : "customer");
          setTrialStatusMessage(buildLifecycleMessage(lifecycleState, remainingDays));
          return;
        }
      }

      if (!cancelled) {
        setPricingContext("guest");
        setPortalLifecycleState(null);
        setTrialStatusMessage(null);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const primaryAction = useMemo(
    () => getPrimaryAction(pricingContext, portalLifecycleState),
    [pricingContext, portalLifecycleState]
  );
  const secondaryAction = useMemo(() => getSecondaryAction(pricingContext), [pricingContext]);
  const cardCta = useMemo(() => getCardCta(pricingContext), [pricingContext]);

  return (
    <>
      <section className="grain-overlay relative overflow-hidden rounded-[36px] border border-line bg-white px-6 py-8 shadow-brand md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-warning to-accent" />
        <div className="absolute -left-14 top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -right-12 bottom-0 h-44 w-44 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Fiyatlandirma</p>
            <h1 className="mt-4 max-w-3xl font-heading text-4xl leading-tight text-text md:text-6xl">
              Isletmene uygun lisansi sec, dakikalar icinde aktif kullanima gec.
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-text/75">
              14 gun sureli deneme kredi karti zorunlulugu olmadan baslar. Deneme sadece sinirli sure ve plan limitleriyle calisir. Canli satis ve odeme sadece Desktop POS tarafinda calisir; Mobile uygulama operasyon takip/kontrol icindir ve kasiyer checkout akisi mobilde yoktur. Web bu sayfada sadece fiyat, hesap ve lisans yonetimi icindir.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryAction.href as never} className={buttonVariants({ variant: "primary", size: "lg" })}>
                {primaryAction.label}
              </Link>
              <Link
                href={secondaryAction.href as never}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {secondaryAction.label}
              </Link>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-text/60">
              Kredi karti gerekmez • Kurulum 5 dakika • Aktivasyon tek adim
            </p>
            {trialStatusMessage ? (
              <p className="mt-3 rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
                {trialStatusMessage}
              </p>
            ) : null}
          </div>

          <Card className="rounded-[28px] border-slate-200 bg-slate-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Lisans modeli</p>
            <div className="mt-4 space-y-3 text-sm text-white/85">
              <p>1) Plan secilir ve lisans olusur.</p>
              <p>2) Desktop POS veya Mobile Operations uygulamasi indirilir.</p>
              <p>3) Lisans aktive edilir; satis/odeme sadece Desktop POS tarafinda acilir. Mobile uygulama operasyon izleme ve kontrol icin kullanilir.</p>
            </div>
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/80">
              Uygulamayi indirmek ucretsizdir. Aktif kullanim icin lisans gerekir.
            </p>
          </Card>
        </div>
      </section>

      <section className="rounded-[32px] border border-line bg-white px-6 py-7 md:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Faturalama secimi</p>
            <h2 className="mt-2 font-heading text-3xl text-text">Aylik veya yillik secin</h2>
            <p className="mt-2 text-sm text-text/72">
              Yillik odemede %20 tasarruf edin. Aylik esdegeri kartlarin ustunde net gorun.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-line bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                cycle === "monthly" ? "bg-brand text-white" : "text-text/65"
              }`}
            >
              Aylik
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                cycle === "yearly" ? "bg-brand text-white" : "text-text/65"
              }`}
            >
              Yillik (%20 tasarruf)
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {plans
            .filter((plan) => !plan.enterprise && plan.monthlyPrice && plan.yearlyMonthlyPrice)
            .map((plan) => {
              const yearlyTotal = plan.yearlyMonthlyPrice! * 12;
              const monthlyTotal = plan.monthlyPrice! * 12;
              const savings = monthlyTotal - yearlyTotal;

              return (
                <p key={plan.code} className="rounded-2xl border border-line bg-muted/35 px-4 py-3 text-sm font-semibold text-text/75">
                  {plan.name}: {formatCurrency(plan.monthlyPrice!)} / ay -&gt; {formatCurrency(plan.yearlyMonthlyPrice!)} / ay (yillik odemede {formatCurrency(savings)} tasarruf)
                </p>
              );
            })}
        </div>
      </section>

      <section id="plan-kartlari" className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Planlar</p>
          <h2 className="mt-2 font-heading text-3xl text-text md:text-4xl">Isletmene gore net secim</h2>
          <p className="mt-3 text-base leading-7 text-text/72">
            Ozellik listesi yerine karar vermeyi hizlandiran farklara odaklandik.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isGrowth = plan.code === "pro";
            const monthly = plan.monthlyPrice ?? 0;
            const yearlyMonthly = plan.yearlyMonthlyPrice ?? 0;
            const priceLine = plan.enterprise
              ? "Ozel teklif"
              : cycle === "monthly"
                ? `${formatCurrency(monthly)} / ay`
                : `${formatCurrency(yearlyMonthly)} / ay`;

            const subLine = plan.enterprise
              ? "Kurumsal ihtiyaca ozel fiyatlandirma"
              : cycle === "yearly"
                ? `Yillik odemede aylik esdeger (${formatCurrency(monthly * 12 - yearlyMonthly * 12)} tasarruf)`
                : "Aylik faturalama";

            const cardHref = plan.enterprise
              ? "/contact?subject=enterprise-plan"
              : pricingContext === "reseller"
                ? "/reseller/portal"
                : pricingContext === "customer" || pricingContext === "trial"
                  ? portalSubscriptionRoute
                  : `/checkout?plan=${plan.code}&cycle=${cycle}`;

            const cardLabel = plan.enterprise ? "Iletisime Gec" : cardCta;

            return (
              <Card
                key={plan.code}
                className={
                  isGrowth
                    ? "border-brand bg-brand/[0.04] shadow-[0_24px_80px_rgba(15,108,189,0.18)]"
                    : "bg-white"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                    {plan.name}
                  </p>
                  {plan.badge ? (
                    <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <CardTitle className="mt-3">{plan.valueLine}</CardTitle>
                <p className="mt-3 text-sm text-text/70">{plan.target}</p>
                <p className="mt-6 font-heading text-4xl text-text">{priceLine}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-text/60">{subLine}</p>

                <ul className="mt-5 space-y-2 text-sm text-text/78">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>

                <div className="mt-5 rounded-2xl border border-line bg-muted/35 p-3 text-xs font-semibold uppercase tracking-[0.1em] text-text/70">
                  {plan.limits.devices} • {plan.limits.branches} • {plan.limits.staff}
                </div>

                <div className="mt-6">
                  <Link href={cardHref as never} className={buttonVariants({ variant: "primary", size: "md" })}>
                    {cardLabel}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-text/80">
          Uygulamayi indirmek ucretsizdir. Aktif plan/lisans olmadan canli operasyon yazma akisi acilmaz.
        </p>
      </section>

      <section className="space-y-4 rounded-[30px] border border-line bg-white px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Karsilastirma</p>
            <h2 className="mt-2 font-heading text-3xl text-text">Temel farklar tek tabloda</h2>
          </div>
          <button
            type="button"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            onClick={() => setExpandedComparison((prev) => !prev)}
          >
            {expandedComparison ? "Kisa gorunume don" : "Tum farklari goster"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/35 text-left text-text/65">
              <tr>
                <th className="px-4 py-3">Kriter</th>
                <th className="px-4 py-3">Starter</th>
                <th className="bg-brand/[0.07] px-4 py-3 text-brand">Growth</th>
                <th className="px-4 py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {(expandedComparison ? comparisonRows : comparisonRows.slice(0, 4)).map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold text-text">{row.label}</td>
                  <td className="px-4 py-3 text-text/75">{row.starter}</td>
                  <td className="bg-brand/[0.03] px-4 py-3 font-semibold text-text">{row.growth}</td>
                  <td className="px-4 py-3 text-text/75">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[30px] border border-line bg-white px-6 py-8 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Plan secim rehberi</p>
        <h2 className="mt-2 font-heading text-3xl text-text">Sizin icin hangisi?</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm font-semibold text-text">Starter</p>
            <p className="mt-2 text-sm text-text/70">Tek sube, hizli baslangic ve net kontrol isteyen ekipler.</p>
          </Card>
          <Card className="border-brand/35 bg-brand/[0.04] p-4">
            <p className="text-sm font-semibold text-text">Growth</p>
            <p className="mt-2 text-sm text-text/70">Buyuyen isletmede cihaz, personel ve sube yonetimini tek hatta toplar.</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm font-semibold text-text">Enterprise</p>
            <p className="mt-2 text-sm text-text/70">Zincir yapida ozel rollout, SLA ve kurumsal ihtiyaclar icin tasarlanir.</p>
          </Card>
        </div>
      </section>

      <section className="rounded-[30px] border border-line bg-slate-950 px-6 py-8 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Guvence ve netlik</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            "Istedigin zaman iptal",
            "Yukseltince veri kaybi yok",
            "Odeme sonrasi aninda aktif",
            "Kurulum adimlari sade",
            "Canli destek mevcut"
          ].map((item) => (
            <p key={item} className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/88">
              {item}
            </p>
          ))}
        </div>
        <p className="mt-5 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85">
          Lisans satin alimi ile indirme farklidir: Uygulama dosyasi ucretsiz indirilebilir, fakat
          aktif plan olmadan operasyon acilmaz.
        </p>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Fiyatlandirma SSS</p>
          <h2 className="mt-2 font-heading text-3xl text-text">Karar oncesi kritik sorular</h2>
        </div>
        <div className="grid gap-4">
          {pricingFaq.map((item) => (
            <Card key={item.question}>
              <p className="font-semibold text-text">{item.question}</p>
              <p className="mt-3 text-sm leading-6 text-text/75">{item.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-line bg-white px-6 py-9 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Hazir misiniz?</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl leading-tight text-text md:text-4xl">
          Dogru plani secin, lisansi aktive edin, satisa kesintisiz baslayin.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-text/72">
          Deneme, satin alma, indirme ve aktivasyon adimlari ayni hizada ilerler. Karar aninda
          bosluk birakmaz.
        </p>
        <div className="mt-7">
          <Link href={primaryAction.href as never} className={buttonVariants({ variant: "primary", size: "lg" })}>
            {primaryAction.label}
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-text/60">
            Kredi karti gerekmez • Veri kaybi yok • Aninda aktivasyon
          </p>
        </div>
      </section>
    </>
  );
}

