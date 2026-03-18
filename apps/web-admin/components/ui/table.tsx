import * as React from "react";
import { cn } from "@/lib/cn";

export function TableWrapper(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("overflow-x-auto rounded-xl border border-line bg-surface shadow-sm", props.className)}
    />
  );
}

export function Table(props: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn("min-w-full border-collapse", props.className)} />;
}

export function TableHead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn("bg-muted/70", props.className)} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn("divide-y divide-line", props.className)} />;
}

export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("transition hover:bg-hover/55", props.className)} />;
}

export function TableHeaderCell(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-text/65",
        props.className
      )}
    />
  );
}

export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn("px-4 py-3 text-sm text-text", props.className)} />;
}
