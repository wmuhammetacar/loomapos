"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/commerce-service";

const schema = z.object({
  email: z.string().email("Gecerli bir e-posta girin.")
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
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
        await requestPasswordReset(values.email);
        setMessage("Sifre sifirlama istegi kaydedildi. Kod e-posta kuyruguna alindi.");
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Sifre sifirlama istegi basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Forgot password</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        Portal sifre sifirlama akisi yalnizca commercial account icindir. POS operasyon
        hesaplarini etkilemez.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">E-posta</label>
          <Input {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        {message ? <p className="text-sm text-brand">{message}</p> : null}
        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Gonderiliyor..." : "Sifirlama istegi gonder"}
        </Button>
      </form>
    </Card>
  );
}
