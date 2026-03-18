import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-line bg-muted/35 p-8 text-center shadow-sm",
        className
      )}
    >
      {icon ? <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface">{icon}</div> : null}
      <h3 className="font-heading text-xl text-text">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-text/70">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
