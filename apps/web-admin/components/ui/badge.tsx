import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "brand" | "success" | "warning" | "danger" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-line bg-muted text-text/76",
  brand: "border-brand/25 bg-brand/12 text-brand",
  success: "border-success/25 bg-success/12 text-success",
  warning: "border-warning/25 bg-warning/12 text-warning",
  danger: "border-danger/25 bg-danger/12 text-danger",
  info: "border-info/25 bg-info/12 text-info"
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center rounded-pill border px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em]",
        variantClasses[variant],
        className
      )}
    />
  );
}
