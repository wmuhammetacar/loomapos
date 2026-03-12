import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-text outline-none ring-offset-white transition placeholder:text-text/40 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
