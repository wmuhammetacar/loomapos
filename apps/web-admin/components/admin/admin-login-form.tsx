"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginInternalAdmin } from "@/lib/internal-admin-auth-service";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@loomapos.local");
  const [password, setPassword] = useState("ChangeThisNow123!");
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="mx-auto max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Phase 7-10 hardening</p>
      <CardTitle className="mt-3">Internal admin access</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/68">
        Internal admin access now uses backend-issued sessions. Bootstrap credentials come from secure environment configuration.
      </p>

      <div className="mt-6 grid gap-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Internal email" />
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Internal password" />
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <Button
        className="mt-6 w-full"
        onClick={async () => {
          setError(null);
          try {
            await loginInternalAdmin(email, password);
            router.push("/admin");
            router.refresh();
          } catch (issue) {
            setError(issue instanceof Error ? issue.message : "Internal admin login failed.");
          }
        }}
      >
        Sign in
      </Button>
    </Card>
  );
}
