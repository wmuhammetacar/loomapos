import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-12 w-full rounded-full border border-line bg-white px-4 py-2 text-sm text-text outline-none ring-offset-white transition placeholder:text-text/40 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
