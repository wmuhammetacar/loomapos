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
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Indirme ve Aktivasyon Talebi</p>
      <p className="mt-2 text-sm leading-6 text-text/72">
        Iletisim bilgilerinizi birakin; kurulum ve lisans aktivasyon adimlarini ekibinize iletelim.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ad Soyad" />
        <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Sirket adi" />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefon (opsiyonel)" />
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
                setMessage("Talebiniz alindi. Kurulum ve lisans aktivasyon adimlari ekibinize iletilecek.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Talep kaydedilemedi.");
              }
            });
          }}
        >
          {isPending ? "Kaydediliyor..." : "Indirme Bilgisi Gonder"}
        </Button>
        {message ? <p className="text-sm text-text/72">{message}</p> : null}
      </div>
    </div>
  );
}
