import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-surface px-4 py-2 text-sm text-text outline-none ring-offset-surface transition duration-180 placeholder:text-text/45 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-text/45",
        invalid && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
