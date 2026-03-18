import * as React from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded-sm border-line text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          className
        )}
        {...props}
      />
    );

    if (!label) {
      return input;
    }

    return (
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        {input}
        <span className="space-y-1">
          <span className="block text-sm font-medium text-text">{label}</span>
          {description ? <span className="block text-xs text-text/60">{description}</span> : null}
        </span>
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
