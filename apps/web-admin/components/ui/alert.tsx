import * as React from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

type AlertTone = "success" | "warning" | "danger" | "info";

const toneStyles: Record<AlertTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-danger/35 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info"
};

const toneIcons: Record<AlertTone, React.ComponentProps<typeof Icon>["name"]> = {
  success: "analytics",
  warning: "notifications",
  danger: "notifications",
  info: "reports"
};

export function Alert({
  tone = "info",
  title,
  description,
  className,
  action
}: {
  tone?: AlertTone;
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border p-4", toneStyles[tone], className)}>
      <div className="flex items-start gap-3">
        <Icon name={toneIcons[tone]} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-current">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-current/88">{description}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
