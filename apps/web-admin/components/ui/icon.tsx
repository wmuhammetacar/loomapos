import * as React from "react";
import { cn } from "@/lib/cn";

export type IconName =
  | "sales"
  | "inventory"
  | "reports"
  | "users"
  | "branches"
  | "devices"
  | "payments"
  | "settings"
  | "integrations"
  | "analytics"
  | "notifications";

export function Icon({
  name,
  className,
  size = 20,
  strokeWidth = 1.85
}: {
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<IconName, React.ReactNode> = {
  sales: (
    <>
      <path d="M4 18h16" />
      <path d="M6 18V9" />
      <path d="M12 18V6" />
      <path d="M18 18v-5" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 7l8-4 8 4-8 4-8-4Z" />
      <path d="M4 7v10l8 4 8-4V7" />
      <path d="M12 11v10" />
    </>
  ),
  reports: (
    <>
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M15 4v3h3" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  users: (
    <>
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="9" r="3" />
      <path d="M20 19a3 3 0 0 0-3-3" />
      <path d="M4 19a3 3 0 0 1 3-3" />
    </>
  ),
  branches: (
    <>
      <path d="M12 3v18" />
      <path d="M12 7h7" />
      <path d="M12 12h5" />
      <path d="M12 17h8" />
      <circle cx="12" cy="3" r="1" />
    </>
  ),
  devices: (
    <>
      <rect x="4" y="5" width="16" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 17v3" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 14h3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-1.7-1L14.5 3h-5L8.9 6a7 7 0 0 0-1.7 1l-2.5-1-2 3.4L4.8 11a7 7 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7 7 0 0 0 1.7 1l.6 3h5l.6-3a7 7 0 0 0 1.7-1l2.5 1 2-3.4-2.1-1.6c.1-.3.1-.6.1-1Z" />
    </>
  ),
  integrations: (
    <>
      <path d="M8 8h4" />
      <path d="M12 16h4" />
      <path d="M8 8a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4" />
      <path d="M16 16a2 2 0 1 0 0-4h-4a2 2 0 1 1 0-4" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 18h16" />
      <path d="M7 18v-7" />
      <path d="M12 18V9" />
      <path d="M17 18v-4" />
      <path d="m7 11 5-2 5 5" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 15h12" />
      <path d="M8 15V10a4 4 0 1 1 8 0v5" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  )
};
