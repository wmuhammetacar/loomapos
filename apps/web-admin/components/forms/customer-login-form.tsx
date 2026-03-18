"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginCustomerWithFallback } from "@/lib/commerce-service";

const schema = z.object({
  email: z.string().email("Gecerli bir e-posta girin."),
  password: z.string().min(6, "Sifre en az 6 karakter olmali.")
});

type FormValues = z.infer<typeof schema>;

export function CustomerLoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const returnToParam = searchParams.get("return_to");
  const returnTo =
    returnToParam && returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : "/portal/onboarding";

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await loginCustomerWithFallback(values.email, values.password);
        window.location.assign(returnTo);
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Giris basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Customer login</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        Portalda sadece lisans, abonelik, indirme ve billing goruntulenir. Operasyonel
        ekranlar burada yer almaz. E-posta dogrulamasi zorunluysa giris oncesi bunu
        tamamlamaniz gerekir.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">E-posta</label>
          <Input placeholder="firma@ornek.com" {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Sifre</label>
          <Input type="password" placeholder="******" {...register("password")} />
          {errors.password ? (
            <p className="text-xs text-danger">{errors.password.message}</p>
          ) : null}
        </div>
        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Giris yapiliyor..." : "Giris Yap"}
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-text/65">
        <Link href="/register" className="font-semibold text-brand">
          Hesap olustur
        </Link>
        <Link href="/forgot-password" className="font-semibold text-text">
          Sifremi unuttum
        </Link>
        <span>Heniz musteri degilseniz once plan secin.</span>
      </div>
    </Card>
  );
}
