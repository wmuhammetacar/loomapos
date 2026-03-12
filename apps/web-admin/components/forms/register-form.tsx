"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { registerCustomerAccountWithFallback } from "@/lib/commerce-service";

const schema = z.object({
  fullName: z.string().min(3, "Ad soyad gerekli."),
  companyName: z.string().min(2, "Sirket adi gerekli."),
  email: z.string().email("Gecerli bir e-posta girin."),
  phone: z.string().min(10, "Telefon numarasi gerekli."),
  password: z.string().min(6, "Sifre en az 6 karakter olmali.")
});

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
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
        await registerCustomerAccountWithFallback(values);
        router.push("/pricing");
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Kayit basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-2xl">
      <CardTitle>Customer registration</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        Bu kayit sadece hesap portaliniz ve checkout hizlandirma icindir. Web katmani
        operasyonel POS hesaplari acmaz. Gerekirse e-posta dogrulamasi sonrasinda portal
        erisimi acilir.
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Ad Soyad</label>
          <Input {...register("fullName")} />
          {errors.fullName ? <p className="text-xs text-danger">{errors.fullName.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Sirket Adi</label>
          <Input {...register("companyName")} />
          {errors.companyName ? <p className="text-xs text-danger">{errors.companyName.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">E-posta</label>
          <Input {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Telefon</label>
          <Input {...register("phone")} />
          {errors.phone ? <p className="text-xs text-danger">{errors.phone.message}</p> : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-text">Sifre</label>
          <Input type="password" {...register("password")} />
          {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
        </div>
        {errors.root ? (
          <p className="text-sm text-danger md:col-span-2">{errors.root.message}</p>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Hesap olusturuluyor..." : "Kaydol ve Planlara Gec"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
