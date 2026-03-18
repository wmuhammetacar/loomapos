import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        text: "var(--text)",
        brand: "var(--brand)",
        "brand-strong": "var(--brand-strong)",
        accent: "var(--accent)",
        line: "var(--line)",
        muted: "var(--muted)",
        hover: "var(--ds-color-hover)",
        active: "var(--ds-color-active)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)"
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)']
      },
      spacing: {
        xs: "var(--ds-space-xs)",
        sm: "var(--ds-space-sm)",
        md: "var(--ds-space-md)",
        lg: "var(--ds-space-lg)",
        xl: "var(--ds-space-xl)",
        xxl: "var(--ds-space-xxl)"
      },
      borderRadius: {
        xs: "var(--ds-radius-xs)",
        sm: "var(--ds-radius-sm)",
        md: "var(--ds-radius-md)",
        lg: "var(--ds-radius-lg)",
        xl: "var(--ds-radius-xl)",
        pill: "var(--ds-radius-pill)"
      },
      boxShadow: {
        sm: "var(--ds-shadow-sm)",
        md: "var(--ds-shadow-md)",
        lg: "var(--ds-shadow-lg)",
        brand: "0 20px 56px color-mix(in srgb, var(--brand) 24%, transparent)",
        focus: "0 0 0 3px var(--ds-color-ring)"
      },
      transitionDuration: {
        120: "120ms",
        180: "180ms",
        260: "260ms"
      },
      screens: {
        mobile: "480px",
        tablet: "768px",
        desktop: "1024px",
        wide: "1440px"
      }
    }
  },
  plugins: []
};

export default config;
