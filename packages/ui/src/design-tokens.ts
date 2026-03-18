export type ThemeMode = "light" | "dark";

export const productSurfaces = [
  "marketing-website",
  "customer-portal",
  "reseller-portal",
  "admin-dashboard",
  "desktop-pos",
  "mobile-pos",
  "documentation-portal"
] as const;

export type ProductSurface = (typeof productSurfaces)[number];

export interface ColorScale {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  muted: string;
  text: string;
  textMuted: string;
  hover: string;
  active: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  ring: string;
}

export interface TypographyToken {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

export interface DesignTokens {
  colors: Record<ThemeMode, ColorScale>;
  typography: {
    h1: TypographyToken;
    h2: TypographyToken;
    h3: TypographyToken;
    h4: TypographyToken;
    body: TypographyToken;
    bodySecondary: TypographyToken;
    caption: TypographyToken;
    label: TypographyToken;
  };
  spacing: {
    gridBase: number;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  radius: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    pill: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    focus: string;
  };
  transitions: {
    quick: string;
    base: string;
    slow: string;
  };
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };
}

export const designTokens: DesignTokens = {
  colors: {
    light: {
      primary: "#0F6CBD",
      secondary: "#0F766E",
      accent: "#F59E0B",
      background: "#F6F8FC",
      surface: "#FFFFFF",
      border: "#D7E0EA",
      muted: "#EEF3F8",
      text: "#122033",
      textMuted: "#5B6C80",
      hover: "#E7EEF7",
      active: "#D6E4F6",
      success: "#15803D",
      warning: "#D97706",
      error: "#DC2626",
      info: "#2563EB",
      ring: "rgba(15,108,189,0.28)"
    },
    dark: {
      primary: "#63B3FF",
      secondary: "#4FD1C5",
      accent: "#F6C453",
      background: "#0B1220",
      surface: "#111A2A",
      border: "#2C3A4D",
      muted: "#1A2638",
      text: "#E7EEF9",
      textMuted: "#9FB1C9",
      hover: "#1D2A3E",
      active: "#263750",
      success: "#4ADE80",
      warning: "#FBBF24",
      error: "#F87171",
      info: "#60A5FA",
      ring: "rgba(99,179,255,0.35)"
    }
  },
  typography: {
    h1: {
      fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
      fontSize: "3.5rem",
      lineHeight: "1.08",
      fontWeight: 800,
      letterSpacing: "-0.02em"
    },
    h2: {
      fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
      fontSize: "2.25rem",
      lineHeight: "1.2",
      fontWeight: 750,
      letterSpacing: "-0.01em"
    },
    h3: {
      fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
      fontSize: "1.5rem",
      lineHeight: "1.25",
      fontWeight: 700
    },
    h4: {
      fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
      fontSize: "1.125rem",
      lineHeight: "1.35",
      fontWeight: 650
    },
    body: {
      fontFamily: '"Manrope", "Inter", "Segoe UI", sans-serif',
      fontSize: "1rem",
      lineHeight: "1.6",
      fontWeight: 500
    },
    bodySecondary: {
      fontFamily: '"Manrope", "Inter", "Segoe UI", sans-serif',
      fontSize: "0.9375rem",
      lineHeight: "1.55",
      fontWeight: 500
    },
    caption: {
      fontFamily: '"Manrope", "Inter", "Segoe UI", sans-serif',
      fontSize: "0.75rem",
      lineHeight: "1.4",
      fontWeight: 600,
      letterSpacing: "0.06em"
    },
    label: {
      fontFamily: '"Manrope", "Inter", "Segoe UI", sans-serif',
      fontSize: "0.875rem",
      lineHeight: "1.35",
      fontWeight: 650
    }
  },
  spacing: {
    gridBase: 4,
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    xxl: "3rem"
  },
  radius: {
    xs: "0.375rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    pill: "9999px"
  },
  shadows: {
    sm: "0 4px 12px rgba(15,32,51,0.08)",
    md: "0 12px 30px rgba(15,32,51,0.12)",
    lg: "0 28px 72px rgba(15,32,51,0.16)",
    focus: "0 0 0 3px rgba(15,108,189,0.26)"
  },
  transitions: {
    quick: "120ms ease",
    base: "180ms ease",
    slow: "260ms ease"
  },
  breakpoints: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1440
  }
};

export const statusPalette = {
  success: designTokens.colors.light.success,
  warning: designTokens.colors.light.warning,
  error: designTokens.colors.light.error,
  info: designTokens.colors.light.info
} as const;

export const iconTokens = {
  strokeWidth: 1.85,
  rounded: true,
  defaultSize: 20,
  family: "looma-line"
} as const;

export function toCssVariables(mode: ThemeMode = "light") {
  const colors = designTokens.colors[mode];
  return {
    "--ds-color-primary": colors.primary,
    "--ds-color-secondary": colors.secondary,
    "--ds-color-accent": colors.accent,
    "--ds-color-background": colors.background,
    "--ds-color-surface": colors.surface,
    "--ds-color-border": colors.border,
    "--ds-color-muted": colors.muted,
    "--ds-color-text": colors.text,
    "--ds-color-text-muted": colors.textMuted,
    "--ds-color-hover": colors.hover,
    "--ds-color-active": colors.active,
    "--ds-color-success": colors.success,
    "--ds-color-warning": colors.warning,
    "--ds-color-error": colors.error,
    "--ds-color-info": colors.info,
    "--ds-color-ring": colors.ring,
    "--ds-space-xs": designTokens.spacing.xs,
    "--ds-space-sm": designTokens.spacing.sm,
    "--ds-space-md": designTokens.spacing.md,
    "--ds-space-lg": designTokens.spacing.lg,
    "--ds-space-xl": designTokens.spacing.xl,
    "--ds-space-xxl": designTokens.spacing.xxl,
    "--ds-radius-sm": designTokens.radius.sm,
    "--ds-radius-md": designTokens.radius.md,
    "--ds-radius-lg": designTokens.radius.lg,
    "--ds-radius-xl": designTokens.radius.xl,
    "--ds-shadow-sm": designTokens.shadows.sm,
    "--ds-shadow-md": designTokens.shadows.md,
    "--ds-shadow-lg": designTokens.shadows.lg,
    "--ds-motion-quick": designTokens.transitions.quick,
    "--ds-motion-base": designTokens.transitions.base,
    "--ds-motion-slow": designTokens.transitions.slow
  };
}
