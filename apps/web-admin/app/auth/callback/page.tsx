"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { completeOidcCallback } from "@/lib/auth";

function AuthCallbackInner() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("OIDC dogrulamasi yapiliyor...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (error) {
        setErrorMessage(`OIDC hata: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`);
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        setErrorMessage("OIDC callback parametreleri eksik.");
        return;
      }

      try {
        const returnTo = await completeOidcCallback(code, state);
        if (disposed) {
          return;
        }
        setMessage("Giris basarili, yonlendiriliyor...");
        window.location.assign(returnTo || "/");
      } catch (callbackError) {
        if (disposed) {
          return;
        }
        setErrorMessage(
          callbackError instanceof Error ? callbackError.message : "OIDC callback basarisiz."
        );
      }
    };

    void run();
    return () => {
      disposed = true;
    };
  }, [searchParams]);

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <CardTitle>OIDC Callback</CardTitle>
        {!errorMessage ? <p className="mt-3 text-sm text-text/70">{message}</p> : null}
        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
      </Card>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
