"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { loadResellerPortalSnapshotWithFallback } from "@/lib/commerce-service";

type ResellerPortalSection = "overview" | "customers" | "commissions" | "licenses";

export function ResellerPortalPanels({ section }: { section: ResellerPortalSection }) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadResellerPortalSnapshotWithFallback>> | null>(null);

  useEffect(() => {
    void loadResellerPortalSnapshotWithFallback().then(setSnapshot);
  }, []);

  if (!snapshot) {
    return (
      <Card>
        <CardTitle>Reseller verisi bulunamadi</CardTitle>
        <p className="mt-3 text-sm leading-6 text-text/72">
          Onayli bayi hesabiyla giris yaptiginizdan emin olun.
        </p>
      </Card>
    );
  }

  if (section === "overview") {
    const accrued = snapshot.commissions
      .filter((item) => item.status === "accrued")
      .reduce((sum, item) => sum + item.amount, 0);

    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Referral code" value={snapshot.reseller.referralCode} />
        <StatCard label="Customer count" value={String(snapshot.customers.length)} />
        <StatCard label="Accrued total" value={`${accrued.toFixed(2)} TRY`} />
        <StatCard label="Commission rate" value={`${snapshot.reseller.commissionRate * 100}%`} />
      </div>
    );
  }

  if (section === "customers") {
    return (
      <Card>
        <CardTitle>Reseller customers</CardTitle>
        <div className="mt-5 space-y-3">
          {snapshot.customers.length === 0 ? (
            <p className="text-sm text-text/70">Henuz bagli musteri yok.</p>
          ) : (
            snapshot.customers.map((customer) => (
              <div key={customer.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
                <p className="font-semibold text-text">{customer.companyName}</p>
                <p className="mt-1 text-sm text-text/70">{customer.email}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    );
  }

  if (section === "commissions") {
    return (
      <Card>
        <CardTitle>Commissions</CardTitle>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-text/55">
                <th className="py-3">Tenant</th>
                <th className="py-3">Amount</th>
                <th className="py-3">Rate</th>
                <th className="py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.commissions.map((item) => (
                <tr key={item.id} className="border-b border-line/80">
                  <td className="py-3 font-mono">{item.tenantId}</td>
                  <td className="py-3">{item.amount.toFixed(2)} TRY</td>
                  <td className="py-3">%{item.rate * 100}</td>
                  <td className="py-3 uppercase">{item.status}</td>
                </tr>
              ))}
              {snapshot.commissions.length === 0 ? (
                <tr>
                  <td className="py-3 text-text/70" colSpan={4}>
                    Henuz komisyon kaydi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>License-ready customers</CardTitle>
      <div className="mt-5 space-y-3">
        {snapshot.licenseReadyCustomers.length === 0 ? (
          <p className="text-sm text-text/70">Lisansa gecmis musteri bulunmuyor.</p>
        ) : (
          snapshot.licenseReadyCustomers.map((customer) => (
            <div key={customer.id} className="rounded-[24px] border border-line bg-muted/30 px-4 py-4">
              <p className="font-semibold text-text">{customer.companyName}</p>
              <p className="mt-1 text-sm text-text/70">Referral: {customer.referredByCode}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}
