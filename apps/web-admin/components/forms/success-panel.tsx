"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { loadCheckoutSuccessWithFallback } from "@/lib/commerce-service";

export function SuccessPanel() {
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadCheckoutSuccessWithFallback>> | null>(null);

  useEffect(() => {
    void loadCheckoutSuccessWithFallback(
      searchParams.get("checkout"),
      searchParams.get("receipt")
    ).then(setSnapshot);
  }, [searchParams]);

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Satinalma kaydi bulunamadi</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/70">
          Bu sayfa en son checkout sonucunu gostermek icindir.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
          Payment success
        </p>
        <CardTitle className="mt-2">Lisansiniz hazir</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Info label="Tenant / Company" value={snapshot.companyName} />
          <Info label="Current plan" value={snapshot.planCode} />
          <Info label="Billing period" value={snapshot.billingPeriod} />
          <Info label="License expiry" value={formatDate(snapshot.licenseExpiresAt ?? undefined)} />
          <Info label="License status" value={snapshot.licenseStatus ?? "-"} />
          <Info label="Invoice no" value={snapshot.invoiceNo ?? "-"} />
        </div>
      </Card>

      <Card>
        <CardTitle>Lisans anahtari</CardTitle>
        <p className="mt-4 rounded-[24px] border border-line bg-muted/40 px-4 py-4 font-mono text-sm text-text">
          {snapshot.licenseKey ?? "-"}
        </p>
        <div className="mt-5 space-y-3 text-sm leading-6 text-text/72">
          <p>Sonraki adimlar:</p>
          <ol className="space-y-2">
            <li>1. Desktop veya Mobile uygulamayi indirin.</li>
            <li>2. Ilk acilista bu lisans anahtarini kullanin.</li>
            <li>3. Cihaz aktivasyonu tamamlandiginda operasyona uygulama icinden gecin.</li>
          </ol>
        </div>
        {snapshot.downloads.length > 0 ? (
          <div className="mt-6 space-y-3">
            {snapshot.downloads.slice(0, 3).map((asset) => (
              <div key={asset.assetId} className="rounded-[24px] border border-line bg-muted/30 px-4 py-3">
                <p className="font-semibold text-text">{asset.title}</p>
                <p className="mt-1 text-sm text-text/68">
                  {asset.version} · {asset.releaseDate} · {asset.platform}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/portal" className="text-brand">
            Portal&apos;a git
          </Link>
          <Link href="/download" className="text-text">
            Download center
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
      <p className="text-sm text-text/60">{label}</p>
      <p className="mt-2 text-base font-semibold text-text">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("tr-TR");
}
