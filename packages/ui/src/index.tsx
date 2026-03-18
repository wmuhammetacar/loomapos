import type { ReactNode } from "react";
import {
  designTokens,
  iconTokens,
  productSurfaces,
  statusPalette,
  toCssVariables,
  type DesignTokens,
  type ProductSurface,
  type ThemeMode
} from "./design-tokens";
import { loomaBrandIdentity, screenshotStandards, type BrandIdentity } from "./brand-identity";
import { componentCatalog, formPatterns, qaChecklist, type ComponentDocItem } from "./component-catalog";

export {
  componentCatalog,
  designTokens,
  formPatterns,
  iconTokens,
  loomaBrandIdentity,
  productSurfaces,
  qaChecklist,
  screenshotStandards,
  statusPalette,
  toCssVariables
};

export type {
  BrandIdentity,
  ComponentDocItem,
  DesignTokens,
  ProductSurface,
  ThemeMode
};

export function StatCard(props: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  tone?: "default" | "brand" | "success" | "warning";
}) {
  const toneMap = {
    default: {
      border: "#D7E0EA",
      value: "#122033"
    },
    brand: {
      border: "#A9CDF4",
      value: "#0F6CBD"
    },
    success: {
      border: "#A7E2C1",
      value: "#15803D"
    },
    warning: {
      border: "#F8D7A0",
      value: "#D97706"
    }
  } as const;

  const tone = toneMap[props.tone ?? "default"];

  return (
    <article
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        padding: 16,
        background: "#FFFFFF"
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#5B6C80", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {props.title}
      </p>
      <p style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 780, lineHeight: 1.1, color: tone.value }}>
        {props.value}
      </p>
      {props.subtitle ? (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#5B6C80" }}>{props.subtitle}</p>
      ) : null}
    </article>
  );
}

export function StatusPill(props: {
  label: string;
  tone?: "success" | "warning" | "error" | "info";
}) {
  const tone = props.tone ?? "info";
  const palette = {
    success: { bg: "rgba(21,128,61,0.14)", color: "#15803D" },
    warning: { bg: "rgba(217,119,6,0.14)", color: "#D97706" },
    error: { bg: "rgba(220,38,38,0.14)", color: "#DC2626" },
    info: { bg: "rgba(37,99,235,0.14)", color: "#2563EB" }
  } as const;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: palette[tone].bg,
        color: palette[tone].color
      }}
    >
      {props.label}
    </span>
  );
}
