import { cn } from "@/lib/cn";

export function Progress({
  value,
  max = 100,
  className,
  label
}: {
  value: number;
  max?: number;
  className?: string;
  label?: string;
}) {
  const safeMax = max <= 0 ? 100 : max;
  const boundedValue = Math.min(Math.max(value, 0), safeMax);
  const ratio = (boundedValue / safeMax) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text/70">{label}</p> : null}
      <div className="h-2.5 w-full overflow-hidden rounded-pill bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={boundedValue}>
        <div className="h-full rounded-pill bg-brand transition-all duration-260" style={{ width: ratio + "%" }} />
      </div>
    </div>
  );
}
