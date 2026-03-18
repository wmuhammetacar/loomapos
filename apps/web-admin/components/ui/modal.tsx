"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface ModalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModalContext = React.createContext<ModalContextValue | null>(null);

export function Modal({
  open,
  defaultOpen = false,
  onOpenChange,
  children
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = open === undefined ? false : true;
  const isOpen = isControlled ? Boolean(open) : internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled === false) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return <ModalContext.Provider value={{ open: isOpen, setOpen }}>{children}</ModalContext.Provider>;
}

export function ModalTrigger({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(ModalContext);
  if (context === null) {
    throw new Error("ModalTrigger must be used inside Modal.");
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-text transition duration-180 hover:border-brand hover:text-brand",
        className
      )}
      onClick={() => context.setOpen(true)}
    >
      {children}
    </button>
  );
}

export function ModalContent({
  children,
  className,
  ariaLabel
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const context = React.useContext(ModalContext);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const isOpen = context === null ? false : context.open;
  const setOpen = context === null ? null : context.setOpen;

  React.useEffect(() => {
    const openSetter = setOpen;
    if (isOpen === false || openSetter === null) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        openSetter?.(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  React.useEffect(() => {
    if (isOpen === false) {
      return;
    }

    const previousActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previousActive?.focus();
  }, [isOpen]);

  if (context === null || isOpen === false) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(9,18,31,0.52)] p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          context.setOpen(false);
        }
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          "w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-lg outline-none",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mb-4 space-y-1", props.className)} />;
}

export function ModalTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cn("font-heading text-2xl font-semibold text-text", props.className)} />;
}

export function ModalDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn("text-sm leading-6 text-text/70", props.className)} />;
}

export function ModalFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("mt-6 flex flex-wrap justify-end gap-3", props.className)} />;
}

export function ModalClose({
  children = "Close",
  className
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(ModalContext);
  if (context === null) {
    throw new Error("ModalClose must be used inside Modal.");
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-pill border border-line px-4 text-sm font-semibold text-text transition duration-180 hover:bg-hover",
        className
      )}
      onClick={() => context.setOpen(false)}
    >
      {children}
    </button>
  );
}
