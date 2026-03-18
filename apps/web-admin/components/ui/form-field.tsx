import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className
}: {
  id?: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-text">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={id ? `${id}-hint` : undefined} className="text-xs text-text/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
