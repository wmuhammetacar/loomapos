"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureCrmLead, trackCrmEvent } from "@/lib/crm-service";

export function NewsletterSignupForm() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-6 rounded-[24px] border border-line bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Newsletter</p>
      <p className="mt-2 text-sm leading-6 text-text/72">
        Receive product updates and growth guides.
      </p>
      <div className="mt-3 grid gap-3">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
        <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !email.trim() || !name.trim() || !companyName.trim()}
          onClick={() => {
            startTransition(async () => {
              try {
                await captureCrmLead({
                  name,
                  email,
                  companyName,
                  source: "newsletter_signup"
                });
                await trackCrmEvent({
                  eventType: "newsletter_signup",
                  name,
                  email,
                  companyName,
                  source: "newsletter_signup",
                  path: typeof window !== "undefined" ? window.location.pathname : "/",
                  detail: "Newsletter signup form submitted"
                });
                setFeedback("Newsletter signup captured.");
              } catch (error) {
                setFeedback(error instanceof Error ? error.message : "Newsletter signup failed.");
              }
            });
          }}
        >
          {isPending ? "Saving..." : "Join Newsletter"}
        </Button>
      </div>
      {feedback ? <p className="mt-2 text-xs text-text/70">{feedback}</p> : null}
    </div>
  );
}
