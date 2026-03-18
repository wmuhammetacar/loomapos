import * as React from "react";
import { cn } from "@/lib/cn";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-line bg-surface p-6 shadow-sm transition duration-180",
        props.className
      )}
    />
  );
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mb-4 space-y-2", props.className)} />;
}

export function CardBody(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("space-y-3", props.className)} />;
}

export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mt-5 flex flex-wrap items-center gap-3", props.className)} />;
}

export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props} className={cn("font-heading text-xl font-semibold text-text", props.className)} />;
}

export function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm leading-6 text-text/72", props.className)} />;
}
