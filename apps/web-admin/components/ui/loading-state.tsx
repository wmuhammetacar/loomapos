import { cn } from "@/lib/cn";

export function LoadingState({
  title = "Loading data",
  description = "Please wait while we prepare the latest information.",
  rows = 3,
  className
}: {
  title?: string;
  description?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-6 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="text-xs text-text/60">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
