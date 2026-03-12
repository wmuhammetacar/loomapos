"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyEmail } from "@/lib/commerce-service";

const schema = z.object({
  token: z.string().min(8, "Dogrulama tokeni gerekli.")
});

type FormValues = z.infer<typeof schema>;

export function VerifyEmailForm() {
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
      token: searchParams.get("token") ?? ""
    }
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        await verifyEmail(values.token);
        router.push("/login?verified=1");
      } catch (error) {
        setError("root", {
          message: error instanceof Error ? error.message : "E-posta dogrulamasi basarisiz."
        });
      }
    });
  });

  return (
    <Card className="max-w-xl">
      <CardTitle>Email verification</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/70">
        Commercial portal hesabiniz icin gonderilen dogrulama kodunu girin.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-text">Verification token</label>
          <Input {...register("token")} />
          {errors.token ? <p className="text-xs text-danger">{errors.token.message}</p> : null}
        </div>
        {errors.root ? <p className="text-sm text-danger">{errors.root.message}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Dogrulaniyor..." : "E-postayi dogrula"}
        </Button>
      </form>
    </Card>
  );
}
