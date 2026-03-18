import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        "min-h-28 w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-6 text-text outline-none ring-offset-surface transition duration-180 placeholder:text-text/45 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text/45",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
