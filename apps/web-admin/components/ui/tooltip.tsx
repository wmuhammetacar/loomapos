"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tooltip({
  content,
  children,
  side = "top",
  className
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const sideClass =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "right"
        ? "left-full top-1/2 ml-2 -translate-y-1/2"
        : side === "bottom"
          ? "left-1/2 top-full mt-2 -translate-x-1/2"
          : "right-full top-1/2 mr-2 -translate-y-1/2";

  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 max-w-[220px] rounded-md border border-line bg-surface px-3 py-2 text-xs leading-5 text-text opacity-0 shadow-md transition duration-180 group-hover:opacity-100 group-focus-within:opacity-100",
          sideClass
        )}
      >
        {content}
      </span>
    </span>
  );
}
