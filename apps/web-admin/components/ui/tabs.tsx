"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className
}: {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) {
        setInternalValue(next);
      }
      onValueChange?.(next);
    },
    [onValueChange, value]
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-pill border border-line bg-muted p-1", className)}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used inside Tabs.");
  }

  const active = context.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`tab-panel-${value}`}
      disabled={disabled}
      onClick={() => context.setValue(value)}
      className={cn(
        "rounded-pill px-4 py-2 text-sm font-semibold transition duration-180",
        active ? "bg-surface text-brand shadow-sm" : "text-text/70 hover:text-text",
        disabled && "cursor-not-allowed opacity-45",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context || context.value !== value) {
    return null;
  }

  return (
    <div id={`tab-panel-${value}`} role="tabpanel" className={cn("outline-none", className)}>
      {children}
    </div>
  );
}
