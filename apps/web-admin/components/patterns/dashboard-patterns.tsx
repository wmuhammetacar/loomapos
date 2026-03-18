import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  trend,
  tone = "default"
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/35"
      : tone === "warning"
        ? "border-warning/35"
        : tone === "danger"
          ? "border-danger/35"
          : "border-line";

  return (
    <Card className={cn("p-4", toneClass)}>
      <CardHeader className="mb-1">
        <CardDescription className="uppercase tracking-[0.08em]">{label}</CardDescription>
      </CardHeader>
      <CardBody className="space-y-1">
        <p className="font-heading text-3xl text-text">{value}</p>
        {trend ? <p className="text-xs text-text/70">{trend}</p> : null}
      </CardBody>
    </Card>
  );
}

export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</section>;
}

export function ChartPanel({
  title,
  subtitle,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <CardHeader className="mb-4">
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export function ActivityFeedPanel({
  title,
  items,
  className
}: {
  title: string;
  items: Array<{ id: string; text: string; time: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-text/65">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-line bg-muted/30 px-3 py-2">
                <p className="text-sm text-text">{item.text}</p>
                <p className="text-xs text-text/60">{item.time}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
