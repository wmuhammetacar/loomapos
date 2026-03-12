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
import { submitResellerApplicationWithFallback } from "@/lib/commerce-service";

const schema = z.object({
  fullName: z.string().min(3, "Ad soyad gerekli."),
  companyName: z.string().min(2, "Sirket adi gerekli."),
  city: z.string().min(2, "Sehir gerekli."),
  phone: z.string().min(10, "Telefon gerekli."),
  email: z.string().email("Gecerli bir e-posta girin."),
  websiteOrSocialProof: z.string().min(3, "Web sitesi veya sosyal kanit gerekli."),
  experience: z.string().min(10, "Deneyiminizi kisaca yazin."),
  message: z.string().min(10, "Mesajinizi yazin.")
});

type FormValues = z.infer<typeof schema>;

export function ResellerApplyForm() {
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const lead = await submitResellerApplicationWithFallback(values);
        setResultCode(lead.referralCode);
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
        <Field label="Ad Soyad" error={errors.fullName?.message}>
          <Input {...register("fullName")} />
        </Field>
        <Field label="Sirket Adi" error={errors.companyName?.message}>
          <Input {...register("companyName")} />
        </Field>
        <Field label="Sehir" error={errors.city?.message}>
          <Input {...register("city")} />
        </Field>
        <Field label="Telefon" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>
        <Field label="E-posta" error={errors.email?.message}>
          <Input {...register("email")} />
        </Field>
        <Field label="Website / Sosyal Kanit" error={errors.websiteOrSocialProof?.message}>
          <Input {...register("websiteOrSocialProof")} />
        </Field>
        <Field label="Deneyim" error={errors.experience?.message} className="md:col-span-2">
          <Textarea {...register("experience")} />
        </Field>
        <Field label="Mesaj" error={errors.message?.message} className="md:col-span-2">
          <Textarea {...register("message")} />
        </Field>
        {errors.root ? (
          <p className="text-sm text-danger md:col-span-2">{errors.root.message}</p>
        ) : null}
        {resultCode ? (
          <div className="rounded-[24px] border border-brand/20 bg-brand/10 px-5 py-4 text-sm text-text md:col-span-2">
            Basvurunuz kaydedildi. Takip kodunuz: <strong>{resultCode}</strong>. Onay surecinden
            sonra reseller login erisimi acilacaktir.
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
