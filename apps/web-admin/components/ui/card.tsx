import * as React from "react";
import { cn } from "@/lib/cn";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]",
        props.className
      )}
    />
  );
}

export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn("font-heading text-xl font-semibold text-text", props.className)} />;
}
