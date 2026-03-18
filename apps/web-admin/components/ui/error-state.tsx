import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  description,
  actionLabel = "Try again",
  onAction,
  details,
  className
}: {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  details?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-danger/35 bg-danger/5 p-6", className)}>
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text/80">{description}</p>
      {details ? <div className="mt-3 rounded-lg border border-danger/20 bg-surface p-3 text-xs text-text/70">{details}</div> : null}
      {onAction ? (
        <Button variant="danger" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
