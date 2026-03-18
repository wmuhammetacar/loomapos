import type { ProductSurface } from "./design-tokens";

export interface BrandIdentity {
  brandName: string;
  slogan: string;
  logo: {
    wordmark: string;
    symbol: string;
    monochromeLight: string;
    monochromeDark: string;
  };
  logoSpacingRule: {
    clearSpaceX: number;
    minWidth: number;
  };
  iconStyle: {
    grid: number;
    stroke: number;
    cornerRadius: string;
    lineCap: "round" | "square";
  };
  imagery: {
    marketingBackground: string;
    screenshotFrame: string;
    screenshotHighlightStyle: string;
    illustrationDirection: string;
  };
  typographyVoice: {
    heading: string;
    body: string;
    tone: string;
  };
  accessibility: {
    minimumContrastAA: string;
    preferredContrast: string;
  };
  perSurfaceNotes: Record<ProductSurface, string>;
}

export const loomaBrandIdentity: BrandIdentity = {
  brandName: "LoomaPOS",
  slogan: "Operational clarity, commercial confidence",
  logo: {
    wordmark: "LoomaPOS",
    symbol: "LP monogram",
    monochromeLight: "Use #FFFFFF over dark backgrounds.",
    monochromeDark: "Use #122033 over light backgrounds."
  },
  logoSpacingRule: {
    clearSpaceX: 8,
    minWidth: 88
  },
  iconStyle: {
    grid: 24,
    stroke: 1.85,
    cornerRadius: "2px",
    lineCap: "round"
  },
  imagery: {
    marketingBackground: "Soft gradients + subtle texture; avoid noisy patterns.",
    screenshotFrame: "Rounded 20-24px device/window frame with 1px border.",
    screenshotHighlightStyle: "Use one primary highlight ring and one neutral annotation block.",
    illustrationDirection: "Clean geometric editorial style, no cartoon mascot style."
  },
  typographyVoice: {
    heading: "Confident and precise",
    body: "Clear, service-oriented",
    tone: "Premium SaaS, practical and trustworthy"
  },
  accessibility: {
    minimumContrastAA: "4.5:1 for body text, 3:1 for large text",
    preferredContrast: "7:1 for critical operational indicators"
  },
  perSurfaceNotes: {
    "marketing-website": "High-emotion visuals are allowed, but CTA hierarchy remains strict.",
    "customer-portal": "Prioritize legibility and dense workflows over decorative visuals.",
    "reseller-portal": "Sales and commission metrics should remain scan-friendly and structured.",
    "admin-dashboard": "System health and risk states must use high-contrast status tokens.",
    "desktop-pos": "Task velocity first: fewer decorative layers, stronger focus states.",
    "mobile-pos": "Thumb-zone aware spacing and large touch targets (44px+).",
    "documentation-portal": "Reading comfort first: calm surfaces, consistent heading rhythm."
  }
};

export const screenshotStandards = {
  frameRadius: 22,
  frameBorder: "1px solid rgba(18,32,51,0.16)",
  frameShadow: "0 20px 48px rgba(18,32,51,0.16)",
  highlightColor: "#0F6CBD",
  dimLayer: "rgba(18,32,51,0.08)",
  annotationStyle: "Use concise title + one supporting line; avoid dense callouts.",
  allowedAspectRatios: ["16:10", "16:9", "9:19.5"],
  backgrounds: ["#F6F8FC", "#EEF3F8", "Linear gradient with brand tint"]
} as const;
