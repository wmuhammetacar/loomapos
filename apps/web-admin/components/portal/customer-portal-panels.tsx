"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getValidSession } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api-client";
import {
  loadCustomerPortalSnapshotWithFallback,
  updateCompanyProfileWithFallback,
  type CompanyProfileInput,
  type CustomerPortalSnapshot
} from "@/lib/commerce-service";

type CustomerPortalSection =
  | "overview"
  | "subscription"
  | "licenses"
  | "downloads"
  | "billing"
  | "devices"
  | "company";

export function CustomerPortalPanels({ section }: { section: CustomerPortalSection }) {
  const [snapshot, setSnapshot] = useState<CustomerPortalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadCustomerPortalSnapshotWithFallback()
      .then((result) => {
        if (!active) {
          return;
        }

        setSnapshot(result);
        setError(null);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Portal verisi yuklenemedi.");
      });

    return () => {
      active = false;
    };
  }, []);

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Portal verisi bulunamadi</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/70">
          Once checkout tamamlayin veya mevcut musteri hesabinizla giris yapin.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex gap-3 text-sm">
          <Link href="/pricing" className="font-semibold text-brand">
            Planlari incele
          </Link>
          <Link href="/login" className="font-semibold text-text">
            Login
          </Link>
        </div>
      </Card>
    );
  }

  if (section === "overview") {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <MetricCard label="Company" value={snapshot.customer?.companyName ?? snapshot.overview?.companyName ?? "-"} />
        <MetricCard label="Active plan" value={snapshot.overview?.activePlan ?? snapshot.subscription?.planCode ?? "-"} />
        <MetricCard label="Renewal date" value={formatDate(snapshot.overview?.renewalDate ?? snapshot.subscription?.renewalDate ?? undefined)} />
        <MetricCard label="License status" value={snapshot.overview?.licenseStatus ?? snapshot.license?.status ?? "-"} />
        <MetricCard label="Active devices" value={String(snapshot.overview?.activeDevices ?? snapshot.devices.length)} />
        <MetricCard label="Latest invoice" value={snapshot.overview?.latestInvoice?.invoiceNo ?? snapshot.billing[0]?.invoiceNo ?? "-"} />
        <Card className="md:col-span-2">
          <CardTitle>What this portal does</CardTitle>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-text/72">
            <li>Subscription, license, billing, downloads and device metadata are visible here.</li>
            <li>Desktop and Mobile installers are distributed from a controlled commercial account center.</li>
            <li>No live sale, stock movement or cashier operation is available on the web layer.</li>
          </ul>
        </Card>
      </div>
    );
  }

  if (section === "subscription") {
    return (
      <Card>
        <CardTitle>Subscription management</CardTitle>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <MetricCard label="Plan" value={snapshot.subscription?.planCode ?? "-"} />
          <MetricCard label="Cycle" value={snapshot.subscription?.billingCycle ?? "-"} />
          <MetricCard label="Status" value={snapshot.subscription?.status ?? "-"} />
          <MetricCard label="Renewal" value={formatDate(snapshot.subscription?.renewalDate ?? snapshot.subscription?.currentPeriodEnd)} />
        </div>
      </Card>
    );
  }

  if (section === "licenses") {
    return (
      <div className="grid gap-4">
        {snapshot.licenses.length === 0 ? (
          <Card>
            <CardTitle>No license issued yet</CardTitle>
            <p className="mt-3 text-sm leading-6 text-text/72">
              Lisans, odeme onaylanip provisioning tamamlandiktan sonra burada gorunur.
            </p>
          </Card>
        ) : (
          snapshot.licenses.map((license) => (
            <Card key={license.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <CardTitle>{license.planCode.toUpperCase()} license</CardTitle>
                  <p className="mt-3 rounded-[24px] border border-line bg-muted/30 px-4 py-4 font-mono text-sm text-text">
                    {license.licenseKey}
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <MetricCard label="Status" value={license.status} />
                    <MetricCard label="Expiry" value={formatDate(license.expiresAt)} />
                    <MetricCard label="Device limit" value={license.deviceLimit?.toString() ?? "-"} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <CopyButton value={license.licenseKey} />
                  <Link href="/docs" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-text/72">
                    Activation help
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  if (section === "downloads") {
    return (
      <div className="grid gap-4">
        {snapshot.downloads.map((asset) => (
          <Card key={asset.assetId}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <CardTitle>{asset.title}</CardTitle>
                <p className="mt-2 text-sm text-text/70">
                  Version {asset.version} · {asset.releaseDate} · {asset.platform}
                </p>
                <p className="mt-3 text-sm leading-6 text-text/72">
                  {asset.minimumRequirements}
                </p>
              </div>
              <a
                href={asset.downloadUrl}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                Download
              </a>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoBlock title="Release notes" body={asset.releaseNotesMarkdown} />
              <InfoBlock title="Install guide" body={asset.installGuideMarkdown} />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (section === "billing") {
    return (
      <Card>
        <CardTitle>Billing history</CardTitle>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-text/55">
                <th className="py-3">Invoice</th>
                <th className="py-3">Description</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Status</th>
                <th className="py-3">Issued</th>
                <th className="py-3">Invoice file</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.billing.map((item) => (
                <tr key={item.id} className="border-b border-line/80">
                  <td className="py-3">{item.invoiceNo}</td>
                  <td className="py-3">{item.description}</td>
                  <td className="py-3">
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: item.currency,
                      maximumFractionDigits: 0
                    }).format(item.amount)}
                  </td>
                  <td className="py-3 uppercase">{item.status}</td>
                  <td className="py-3">{formatDate(item.issuedAt)}</td>
                  <td className="py-3">
                    {item.pdfUrl ? (
                      <button
                        type="button"
                        className="font-semibold text-brand"
                        onClick={() => void downloadInvoicePdf(item.pdfUrl!, item.invoiceNo)}
                      >
                        PDF indir
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {snapshot.billing.length === 0 ? (
                <tr>
                  <td className="py-3 text-text/70" colSpan={6}>
                    Henuz fatura kaydi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (section === "devices") {
    return (
      <Card>
        <CardTitle>Device activations</CardTitle>
        {snapshot.devices.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-text/72">
            Henuz aktif cihaz gorunmuyor. Desktop veya Mobile uygulamada lisans aktivasyonu
            tamamlandiginda metadata burada listelenir.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {snapshot.devices.map((device) => (
              <div key={device.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-text">{device.deviceName}</p>
                    <p className="mt-1 text-sm text-text/70">
                      {device.platform} · {device.appVersion ?? "n/a"}
                    </p>
                  </div>
                  <div className="text-sm text-text/65">
                    <p>Activated: {formatDate(device.activatedAt)}</p>
                    <p>Last seen: {formatDate(device.lastSeenAt)}</p>
                    <p>Status: {device.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <CompanySettingsCard
      company={snapshot.customer}
      onSaved={(updated) =>
        setSnapshot((current) =>
          current
            ? {
                ...current,
                customer: updated,
                overview: current.overview
                  ? {
                      ...current.overview,
                      companyName: updated.companyName
                    }
                  : current.overview
              }
            : current
        )
      }
    />
  );
}

function CompanySettingsCard({
  company,
  onSaved
}: {
  company: CustomerPortalSnapshot["customer"];
  onSaved: (company: NonNullable<CustomerPortalSnapshot["customer"]>) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<CompanyProfileInput>({
    companyName: company?.companyName ?? "",
    billingEmail: company?.billingEmail ?? "",
    phone: company?.phone ?? "",
    taxOffice: company?.taxOffice ?? "",
    taxNumber: company?.taxNumber ?? "",
    addressLine: company?.addressLine ?? "",
    city: company?.city ?? "",
    country: company?.country ?? "TR",
    locale: company?.locale ?? "tr-TR"
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      companyName: company?.companyName ?? "",
      billingEmail: company?.billingEmail ?? "",
      phone: company?.phone ?? "",
      taxOffice: company?.taxOffice ?? "",
      taxNumber: company?.taxNumber ?? "",
      addressLine: company?.addressLine ?? "",
      city: company?.city ?? "",
      country: company?.country ?? "TR",
      locale: company?.locale ?? "tr-TR"
    });
  }, [company]);

  return (
    <Card>
      <CardTitle>Company settings</CardTitle>
      <p className="mt-3 text-sm leading-6 text-text/72">
        Temel sirket, fatura ve iletisim bilgileri portalden guncellenebilir. Bu alan
        operasyonel POS ayarlarina acilmaz.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Company name">
          <Input
            value={form.companyName}
            onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
          />
        </Field>
        <Field label="Billing email">
          <Input
            value={form.billingEmail}
            onChange={(event) => setForm((current) => ({ ...current, billingEmail: event.target.value }))}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={form.phone ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </Field>
        <Field label="Tax office">
          <Input
            value={form.taxOffice ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, taxOffice: event.target.value }))}
          />
        </Field>
        <Field label="Tax number">
          <Input
            value={form.taxNumber ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, taxNumber: event.target.value }))}
          />
        </Field>
        <Field label="City">
          <Input
            value={form.city ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
          />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Input
            value={form.addressLine ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, addressLine: event.target.value }))}
          />
        </Field>
        <Field label="Country">
          <Input
            value={form.country ?? "TR"}
            onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
          />
        </Field>
        <Field label="Locale">
          <Input
            value={form.locale ?? "tr-TR"}
            onChange={(event) => setForm((current) => ({ ...current, locale: event.target.value }))}
          />
        </Field>
      </div>
      {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                const updated = await updateCompanyProfileWithFallback(form);
                onSaved(updated);
                setMessage("Company profile updated.");
                setError(null);
              } catch (updateError) {
                setError(
                  updateError instanceof Error
                    ? updateError.message
                    : "Company profile could not be updated."
                );
                setMessage(null);
              }
            });
          }}
        >
          {isPending ? "Saving..." : "Save company profile"}
        </Button>
      </div>
    </Card>
  );
}

async function downloadInvoicePdf(path: string, invoiceNo: string) {
  const session = await getValidSession();
  if (!session?.accessToken) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Invoice download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${invoiceNo}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
      <p className="text-sm font-semibold text-text">{title}</p>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text/72">{body}</p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
      }}
      className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-text/72"
    >
      Copy key
    </button>
  );
}

function Field({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-text">{label}</label>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("tr-TR");
}
