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
import { loginResellerWithFallback } from "@/lib/commerce-service";

const schema = z.object({
  email: z.string().email("Gecerli bir e-posta girin."),
  password: z.string().min(6, "Sifre en az 6 karakter olmali.")
});

type FormValues = z.infer<typeof schema>;

export function ResellerLoginForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const returnTo = searchParams.get("return_to") || "/reseller/portal";
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
        await loginResellerWithFallback(values.email, values.password);
        window.location.assign(returnTo);
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Bayi girisi basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Reseller login</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        Sadece onayli bayiler reseller portalina ulasabilir. Demo girisi:
        <strong> partner@loomapos.com</strong> / <strong>Bayi123!</strong>
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">E-posta</label>
          <Input {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Sifre</label>
          <Input type="password" {...register("password")} />
          {errors.password ? (
            <p className="text-xs text-danger">{errors.password.message}</p>
          ) : null}
        </div>
        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Giris yapiliyor..." : "Bayi Girisi"}
        </Button>
      </form>
      <div className="mt-5 text-sm text-text/65">
        <Link href="/reseller/apply" className="font-semibold text-brand">
          Bayi olmak icin basvur
        </Link>
      </div>
    </Card>
  );
}
