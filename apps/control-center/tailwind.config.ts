import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        text: "var(--text)",
        line: "var(--line)",
        muted: "var(--muted)",
        brand: "var(--brand)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)"
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"]
      },
      boxShadow: {
        sm: "0 4px 12px rgba(15, 32, 51, 0.08)",
        md: "0 12px 30px rgba(15, 32, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
