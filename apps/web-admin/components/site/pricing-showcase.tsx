"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { pricingPlans, planComparisonRows, type BillingCycle } from "@/lib/site-content";

export function PricingShowcase() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-line bg-white p-1">
        {(["monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCycle(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              cycle === value ? "bg-brand text-white" : "text-text/65"
            }`}
          >
            {value === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pricingPlans.map((plan) => (
          <Card
            key={plan.code}
            className={
              plan.highlight
                ? "border-brand/30 bg-white shadow-[0_24px_80px_rgba(234,88,12,0.14)]"
                : "bg-white"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">
              {plan.code}
            </p>
            <CardTitle className="mt-2">{plan.name}</CardTitle>
            <p className="mt-3 text-sm leading-6 text-text/70">{plan.summary}</p>
            <p className="mt-6 font-heading text-4xl text-text">
              {new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: "TRY",
                maximumFractionDigits: 0
              }).format(cycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice)}
            </p>
            <p className="mt-2 text-sm text-text/55">
              {cycle === "yearly" ? "Yillik faturalama" : "Aylik faturalama"}
            </p>
            <ul className="mt-5 space-y-2 text-sm leading-6 text-text/72">
              <li>{plan.branchLimit}</li>
              <li>{plan.deviceLimit}</li>
              <li>{plan.userLimit}</li>
              <li>{plan.supportLevel}</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <Link
                href={`/checkout?plan=${plan.code}&cycle=${cycle}`}
                className="text-sm font-semibold text-brand"
              >
                Checkout
              </Link>
              <Link href="/download" className="text-sm font-semibold text-text">
                Download
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Plan comparison</CardTitle>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-text/55">
                <th className="py-3">Kriter</th>
                <th className="py-3">Starter</th>
                <th className="py-3">Pro</th>
                <th className="py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {planComparisonRows.map((row) => (
                <tr key={row.label} className="border-b border-line/80">
                  <td className="py-3">{row.label}</td>
                  <td className="py-3">{row.starter}</td>
                  <td className="py-3">{row.pro}</td>
                  <td className="py-3">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
