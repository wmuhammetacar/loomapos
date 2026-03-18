import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, placeholder, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-line bg-surface px-4 pr-10 text-sm text-text outline-none transition duration-180 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-muted",
          className
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text/50">▾</span>
    </div>
  )
);

Select.displayName = "Select";
