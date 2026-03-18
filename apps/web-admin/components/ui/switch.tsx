"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-center gap-3", disabled && "opacity-55")}> 
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-pill border transition duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          checked ? "border-brand bg-brand" : "border-line bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition duration-180",
            checked ? "left-6" : "left-0.5"
          )}
        />
      </button>
      {label ? <span className="text-sm font-medium text-text">{label}</span> : null}
    </label>
  );
}
