import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  tone = "info",
  hint
}: {
  title: string;
  value: string | number;
  tone?: "info" | "success" | "warning" | "danger";
  hint?: ReactNode;
}) {
  const toneClass = {
    info: "border-info/20",
    success: "border-success/20",
    warning: "border-warning/20",
    danger: "border-danger/20"
  }[tone];

  return (
    <section className={`rounded-lg border bg-surface p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      {hint ? <p className="mt-2 text-xs text-gray-600">{hint}</p> : null}
    </section>
  );
}
