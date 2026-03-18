import * as React from "react";
import { cn } from "@/lib/cn";

interface RadioOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export function RadioGroup({
  name,
  value,
  options,
  onChange,
  className
}: {
  name: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", className)}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const checked = value === option.value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
              checked ? "border-brand bg-brand/5" : "border-line bg-surface",
              option.disabled && "cursor-not-allowed opacity-55"
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-4 w-4 border-line text-brand focus-visible:ring-2 focus-visible:ring-brand/30"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-text">{option.label}</span>
              {option.description ? (
                <span className="block text-xs text-text/60">{option.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
