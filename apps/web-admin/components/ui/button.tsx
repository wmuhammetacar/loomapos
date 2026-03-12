import * as React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-60",
    size === "sm" && "h-10 px-4 text-sm",
    size === "md" && "h-11 px-5 text-sm",
    size === "lg" && "h-12 px-6 text-sm",
    variant === "primary" && "bg-brand text-white shadow-[0_14px_32px_rgba(234,88,12,0.28)] hover:bg-brand-strong",
    variant === "secondary" && "bg-slate-950 text-white hover:bg-slate-800",
    variant === "outline" && "border border-line bg-white text-text hover:border-brand hover:text-brand",
    variant === "ghost" && "bg-transparent text-text/72 hover:bg-slate-950/5 hover:text-text",
    variant === "danger" && "bg-danger text-white hover:bg-danger/90",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
);

Button.displayName = "Button";
