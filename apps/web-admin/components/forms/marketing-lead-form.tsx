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
import {
  submitMarketingLead,
  type MarketingLeadType
} from "@/lib/marketing-service";

const schema = z.object({
  fullName: z.string().min(3, "Full name is required."),
  companyName: z.string().min(2, "Company name is required."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().min(10, "Phone number is required."),
  message: z.string().min(10, "Please share a short message.")
});

type FormValues = z.infer<typeof schema>;

interface MarketingLeadFormProps {
  type: MarketingLeadType;
  title: string;
  description: string;
  submitLabel: string;
  sourcePath: string;
}

export function MarketingLeadForm({
  type,
  title,
  description,
  submitLabel,
  sourcePath
}: MarketingLeadFormProps) {
  const [resultId, setResultId] = useState<string | null>(null);
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
        const lead = await submitMarketingLead({
          type,
          ...values,
          sourcePath
        });

        await captureCrmLead({
          name: values.fullName,
          email: values.email,
          phone: values.phone,
          companyName: values.companyName,
          source: type === "demo" ? "demo_request" : "contact_form"
        });

        await trackCrmEvent({
          eventType: type === "demo" ? "demo_requested" : "website_visit",
          email: values.email,
          name: values.fullName,
          companyName: values.companyName,
          phone: values.phone,
          source: type === "demo" ? "demo_request" : "contact_form",
          path: sourcePath,
          detail: type === "demo" ? "Demo form submitted" : "Contact form submitted"
        });

        setResultId(lead.id);
        reset();
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Lead could not be saved."
        });
      }
    });
  });

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/72">{description}</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Full name" error={errors.fullName?.message}>
          <Input {...register("fullName")} />
        </Field>
        <Field label="Company name" error={errors.companyName?.message}>
          <Input {...register("companyName")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input {...register("email")} type="email" />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register("phone")} />
        </Field>
        <Field label={type === "demo" ? "What do you want to see in the demo?" : "Message"} error={errors.message?.message} className="md:col-span-2">
          <Textarea {...register("message")} rows={5} />
        </Field>
        {errors.root ? (
          <p className="text-sm text-danger md:col-span-2">{errors.root.message}</p>
        ) : null}
        {resultId ? (
          <div className="rounded-[24px] border border-brand/20 bg-brand/10 px-5 py-4 text-sm text-text md:col-span-2">
            Lead saved successfully. Reference: <strong>{resultId}</strong>.
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
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
