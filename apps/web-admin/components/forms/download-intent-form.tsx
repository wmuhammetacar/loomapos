"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureCrmLead, trackCrmEvent } from "@/lib/crm-service";

export function DownloadIntentForm() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-[28px] border border-line bg-muted/25 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Lead capture</p>
      <p className="mt-2 text-sm leading-6 text-text/72">
        Share contact details to receive installer guidance and activation reminders.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
        <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={isPending || !name.trim() || !companyName.trim() || !email.trim()}
          onClick={() => {
            startTransition(async () => {
              try {
                await captureCrmLead({
                  name,
                  email,
                  phone,
                  companyName,
                  source: "download_attempt"
                });
                await trackCrmEvent({
                  eventType: "download_attempt",
                  name,
                  email,
                  phone,
                  companyName,
                  source: "download_attempt",
                  path: "/download",
                  detail: "Download guidance form submitted"
                });
                setMessage("Download lead captured. Sales team can follow activation readiness.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Download lead could not be captured.");
              }
            });
          }}
        >
          {isPending ? "Saving..." : "Send Download Guidance"}
        </Button>
        {message ? <p className="text-sm text-text/72">{message}</p> : null}
      </div>
    </div>
  );
}
