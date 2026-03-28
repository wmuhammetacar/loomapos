"use client";

import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { captureCrmLead, trackCrmEvent } from "@/lib/crm-service";
import { trackMarketingEvent } from "@/lib/marketing-service";
import { submitResellerGrowthApplication } from "@/lib/reseller-growth-service";

const schema = z.object({
  name: z.string().min(3, "Ad soyad gerekli."),
  companyName: z.string().min(2, "Sirket adi gerekli."),
  email: z.string().email("Gecerli bir e-posta girin."),
  phone: z.string().optional(),
  businessType: z.string().min(2, "Is modeli gerekli."),
  experience: z.string().optional(),
  region: z.string().min(2, "Bolge gerekli.")
});

type FormValues = z.infer<typeof schema>;

export function ResellerApplyForm() {
  const [applicationCode, setApplicationCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const application = await submitResellerGrowthApplication({
          name: values.name,
          companyName: values.companyName,
          email: values.email,
          phone: values.phone,
          businessType: values.businessType,
          experience: values.experience,
          region: values.region
        });

        await captureCrmLead({
          name: values.name,
          email: values.email,
          phone: values.phone,
          companyName: values.companyName,
          source: "reseller_application",
          resellerId: application.applicationId,
          commissionEligible: true
        });

        await trackCrmEvent({
          eventType: "reseller_assigned",
          email: values.email,
          name: values.name,
          companyName: values.companyName,
          phone: values.phone,
          source: "reseller_application",
          resellerId: application.applicationId,
          commissionEligible: true,
          path: "/resellers/apply",
          detail: "Reseller application submitted to phase-15 channel growth workflow."
        });

        trackMarketingEvent({
          type: "lead_submit",
          path: "/resellers/apply",
          label: "reseller_application",
          context: "reseller_apply_form",
          source: values.companyName
        });

        setApplicationCode(application.applicationId);
        reset();
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Basvuru kaydedilemedi."
        });
      }
    });
  });

  return (
    <Card>
      <CardTitle>Bayi basvuru formu</CardTitle>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Ad Soyad" error={errors.name?.message}>
          <Input {...register("name")} />
        </Field>
        <Field label="Sirket Adi" error={errors.companyName?.message}>
          <Input {...register("companyName")} />
        </Field>
        <Field label="E-posta" error={errors.email?.message}>
          <Input {...register("email")} />
        </Field>
        <Field label="Telefon (opsiyonel)" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>
        <Field label="Is modeli" error={errors.businessType?.message}>
          <Input {...register("businessType")} placeholder="Danismanlik, distributor, entegrator..." />
        </Field>
        <Field label="Bolge" error={errors.region?.message}>
          <Input {...register("region")} placeholder="Marmara, Ege, Ic Anadolu..." />
        </Field>
        <Field label="Deneyim (opsiyonel)" error={errors.experience?.message} className="md:col-span-2">
          <Textarea {...register("experience")} placeholder="Satis ve onboarding deneyiminizi kisaca belirtin." />
        </Field>
        {errors.root ? (
          <p className="text-sm text-danger md:col-span-2">{errors.root.message}</p>
        ) : null}
        {applicationCode ? (
          <div className="rounded-[24px] border border-brand/20 bg-brand/10 px-5 py-4 text-sm text-text md:col-span-2">
            Basvurunuz kaydedildi. Takip kodunuz: <strong>{applicationCode}</strong>. Inceleme
            tamamlandiginda tarafiniza onay/red bildirimi yapilacaktir.
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Kaydediliyor..." : "Basvuruyu Gonder"}
          </Button>
        </div>
      </form>
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
