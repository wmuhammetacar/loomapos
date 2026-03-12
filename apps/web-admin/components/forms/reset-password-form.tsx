"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/commerce-service";

const schema = z
  .object({
    token: z.string().min(8, "Sifirlama tokeni gerekli."),
    password: z.string().min(6, "Yeni sifre en az 6 karakter olmali."),
    confirmPassword: z.string().min(6, "Sifre tekrar gerekli.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Sifreler eslesmiyor."
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      token: searchParams.get("token") ?? "",
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await resetPassword(values.token, values.password);
        router.push("/login");
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "Sifre sifirlama basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Reset password</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        E-posta ile ulasan sifirlama tokenini girin ve yeni portal sifrenizi belirleyin.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Token</label>
          <Input {...register("token")} />
          {errors.token ? <p className="text-xs text-danger">{errors.token.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Yeni sifre</label>
          <Input type="password" {...register("password")} />
          {errors.password ? <p className="text-xs text-danger">{errors.password.message}</p> : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Yeni sifre tekrar</label>
          <Input type="password" {...register("confirmPassword")} />
          {errors.confirmPassword ? (
            <p className="text-xs text-danger">{errors.confirmPassword.message}</p>
          ) : null}
        </div>
        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Sifre guncelleniyor..." : "Sifreyi guncelle"}
        </Button>
      </form>
    </Card>
  );
}
