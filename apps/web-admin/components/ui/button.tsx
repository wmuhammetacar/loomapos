import * as React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-55",
    size === "sm" && "h-9 px-3 text-sm",
    size === "md" && "h-11 px-5 text-sm",
    size === "lg" && "h-12 px-6 text-sm",
    variant === "primary" && "bg-brand text-white shadow-brand hover:bg-brand-strong active:translate-y-[1px]",
    variant === "secondary" && "bg-accent text-white hover:brightness-110 active:translate-y-[1px]",
    variant === "outline" && "border border-line bg-surface text-text hover:border-brand hover:text-brand",
    variant === "ghost" && "bg-transparent text-text/75 hover:bg-hover hover:text-text",
    variant === "danger" && "bg-danger text-white hover:brightness-110 active:translate-y-[1px]",
    className
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? <ButtonSpinner /> : leadingIcon}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </button>
  )
);

function ButtonSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden="true"
    />
  );
}

Button.displayName = "Button";
