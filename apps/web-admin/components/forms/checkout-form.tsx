"use client";

import type { ReactNode } from "react";
import { useMemo, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { checkoutWithFallback } from "@/lib/commerce-service";
import { captureCrmLead, trackCrmEvent } from "@/lib/crm-service";
import {
  getPlanByCode,
  pricingPlans,
  type BillingCycle,
  type PlanCode
} from "@/lib/site-content";

const schema = z.object({
  planCode: z.enum(["starter", "pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  fullName: z.string().min(3, "Yetkili kisi bilgisi gerekli."),
  companyName: z.string().min(2, "Sirket adi gerekli."),
  email: z.string().email("Gecerli bir e-posta girin."),
  phone: z.string().min(10, "Telefon gerekli."),
  password: z.string().min(6, "Sifre en az 6 karakter olmali."),
  billingTitle: z.string().min(2, "Fatura unvani gerekli."),
  billingEmail: z.string().email("Fatura e-postasi gerekli."),
  taxOffice: z.string().min(2, "Vergi dairesi gerekli."),
  taxNumber: z.string().min(5, "Vergi numarasi gerekli."),
  addressLine: z.string().min(5, "Fatura adresi gerekli."),
  city: z.string().min(2, "Sehir gerekli."),
  country: z.string().min(2, "Ulke gerekli."),
  locale: z.string().min(2, "Dil/locale gerekli."),
  paymentMethod: z.enum(["card", "bank_transfer"]),
  provider: z.enum(["mock", "stripe", "iyzico", "paytr"]),
  couponCode: z.string().optional(),
  resellerCode: z.string().optional(),
  approve: z.literal(true, {
    errorMap: () => ({ message: "Satin alma onayi gereklidir." })
  })
});

type FormValues = z.infer<typeof schema>;

const selectClassName =
  "h-12 w-full rounded-full border border-line bg-white px-4 text-sm text-text outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const defaultPlan = (searchParams.get("plan") as PlanCode) || "pro";
  const defaultCycle = (searchParams.get("cycle") as BillingCycle) || "monthly";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      planCode: pricingPlans.some((item) => item.code === defaultPlan) ? defaultPlan : "pro",
      billingCycle: defaultCycle === "yearly" ? "yearly" : "monthly",
      fullName: "",
      companyName: "",
      email: "",
      phone: "",
      password: "",
      billingTitle: "",
      billingEmail: "",
      taxOffice: "",
      taxNumber: "",
      addressLine: "",
      city: "",
      country: "TR",
      locale: "tr-TR",
      paymentMethod: "card",
      provider: "mock",
      couponCode: "",
      resellerCode: searchParams.get("reseller") || "",
      approve: true
    }
  });

  const selectedPlan = useWatch({ control, name: "planCode" });
  const selectedCycle = useWatch({ control, name: "billingCycle" });

  const plan = useMemo(() => getPlanByCode(selectedPlan), [selectedPlan]);
  const price = selectedCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await Promise.allSettled([
          captureCrmLead({
            name: values.fullName,
            email: values.email,
            phone: values.phone,
            companyName: values.companyName,
            source: "checkout_start"
          }),
          trackCrmEvent({
            eventType: "signup_started",
            email: values.email,
            name: values.fullName,
            companyName: values.companyName,
            phone: values.phone,
            source: "checkout_start",
            path: "/checkout",
            detail: `Checkout started with ${values.planCode} / ${values.billingCycle}`
          })
        ]);

        const bundle = await checkoutWithFallback({
          fullName: values.fullName,
          companyName: values.companyName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          planCode: values.planCode,
          billingCycle: values.billingCycle,
          paymentMethod: values.paymentMethod,
          provider: values.provider,
          taxOffice: values.taxOffice,
          taxNumber: values.taxNumber,
          addressLine: values.addressLine,
          city: values.city,
          country: values.country,
          locale: values.locale,
          couponCode: values.couponCode,
          resellerCode: values.resellerCode
        });
        if (bundle.checkoutSessionId) {
          window.location.assign(`/success?checkout=${bundle.checkoutSessionId}`);
          return;
        }

        window.location.assign(`/success?receipt=${bundle.receiptId ?? ""}`);
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Checkout tamamlanamadi."
        });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <StepCard step="1" title="Plan secimi">
          <div className="grid gap-3 md:grid-cols-3">
            {pricingPlans.map((item) => (
              <label
                key={item.code}
                className="flex cursor-pointer flex-col rounded-[24px] border border-line bg-muted/30 p-4"
              >
                <input type="radio" value={item.code} className="mb-3" {...register("planCode")} />
                <span className="font-heading text-xl font-semibold text-text">{item.name}</span>
                <span className="mt-2 text-sm text-text/68">{item.summary}</span>
              </label>
            ))}
          </div>
        </StepCard>

        <StepCard step="2" title="Billing period selection">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-[24px] border border-line bg-white p-4">
              <input type="radio" value="monthly" className="mb-3" {...register("billingCycle")} />
              <span className="block font-semibold text-text">Monthly</span>
              <span className="text-sm text-text/68">Aylik yenileme ve hizli baslangic</span>
            </label>
            <label className="rounded-[24px] border border-line bg-white p-4">
              <input type="radio" value="yearly" className="mb-3" {...register("billingCycle")} />
              <span className="block font-semibold text-text">Yearly</span>
              <span className="text-sm text-text/68">Tek fatura tarihi ve daha sade butce</span>
            </label>
          </div>
        </StepCard>

        <StepCard step="3" title="Account creation or login">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Yetkili Kisi" error={errors.fullName?.message}>
              <Input {...register("fullName")} />
            </Field>
            <Field label="Sirket Adi" error={errors.companyName?.message}>
              <Input {...register("companyName")} />
            </Field>
            <Field label="E-posta" error={errors.email?.message}>
              <Input {...register("email")} />
            </Field>
            <Field label="Telefon" error={errors.phone?.message}>
              <Input {...register("phone")} />
            </Field>
            <Field label="Portal Sifresi" error={errors.password?.message} className="md:col-span-2">
              <Input type="password" {...register("password")} />
            </Field>
          </div>
        </StepCard>

        <StepCard step="4" title="Billing info">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fatura Unvani" error={errors.billingTitle?.message}>
              <Input {...register("billingTitle")} />
            </Field>
            <Field label="Fatura E-postasi" error={errors.billingEmail?.message}>
              <Input {...register("billingEmail")} />
            </Field>
            <Field label="Vergi Dairesi" error={errors.taxOffice?.message}>
              <Input {...register("taxOffice")} />
            </Field>
            <Field label="Vergi Numarasi" error={errors.taxNumber?.message}>
              <Input {...register("taxNumber")} />
            </Field>
            <Field label="Fatura Adresi" error={errors.addressLine?.message} className="md:col-span-2">
              <Input {...register("addressLine")} />
            </Field>
            <Field label="Sehir" error={errors.city?.message}>
              <Input {...register("city")} />
            </Field>
            <Field label="Ulke" error={errors.country?.message}>
              <Input {...register("country")} />
            </Field>
            <Field label="Locale" error={errors.locale?.message}>
              <Input {...register("locale")} />
            </Field>
          </div>
        </StepCard>

        <StepCard step="5" title="Payment method">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Odeme yontemi">
              <select className={selectClassName} {...register("paymentMethod")}>
                <option value="card">Kart</option>
                <option value="bank_transfer">Havale / EFT</option>
              </select>
            </Field>
            <Field label="Saglayici">
              <select className={selectClassName} {...register("provider")}>
                <option value="mock">Mock adapter</option>
                <option value="stripe">Stripe-ready</option>
                <option value="iyzico">Iyzico-ready</option>
                <option value="paytr">PayTR-ready</option>
              </select>
            </Field>
            <Field label="Kupon Kodu (opsiyonel)">
              <Input placeholder="PROMO2026" {...register("couponCode")} />
            </Field>
            <Field label="Bayi Kodu (opsiyonel)" className="md:col-span-2">
              <Input placeholder="Orn. MARMAR429" {...register("resellerCode")} />
            </Field>
          </div>
        </StepCard>

        <StepCard step="6" title="Order summary">
          <label className="flex items-start gap-3 rounded-[24px] border border-line bg-muted/30 px-4 py-4 text-sm leading-6 text-text/72">
            <input type="checkbox" className="mt-1" {...register("approve")} />
            Satin alma sonrasi tenant, abonelik, billing kaydi, lisans anahtari ve download
            erisimi olusturulacagini; operasyonel POS yuzeylerinin yalnizca Desktop ve Mobile
            uygulamada acilacagini onayliyorum.
          </label>
          {errors.approve ? <p className="mt-2 text-xs text-danger">{errors.approve.message}</p> : null}
        </StepCard>

        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
      </div>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardTitle>7) Purchase confirmation</CardTitle>
        <div className="mt-5 space-y-4 text-sm text-text/72">
          <div className="flex items-center justify-between">
            <span>Plan</span>
            <strong className="text-text">{plan.name}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Billing period</span>
            <strong className="capitalize text-text">{selectedCycle}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Branch limit</span>
            <strong className="text-text">{plan.branchLimit}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Device limit</span>
            <strong className="text-text">{plan.deviceLimit}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Support</span>
            <strong className="text-text">{plan.supportLevel}</strong>
          </div>
          <div className="rounded-[24px] border border-brand/20 bg-brand/10 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-brand">Total</p>
            <p className="mt-2 font-heading text-4xl text-text">
              {new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: "TRY",
                maximumFractionDigits: 0
              }).format(price)}
            </p>
          </div>
          <ul className="space-y-2">
            <li>Tenant ve customer hesabi olusturulur.</li>
            <li>Lisans anahtari ve sure bilgisi hazirlanir.</li>
            <li>Portal, download ve billing kayitlari aktif olur.</li>
          </ul>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Satinalma tamamlanıyor..." : "Purchase and Create License"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function StepCard({
  step,
  title,
  children
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Step {step}</p>
      <CardTitle className="mt-2">{title}</CardTitle>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function Field({
  label,
  error,
  className,
  children
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-text">{label}</label>
      {children}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
