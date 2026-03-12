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
        warning: "#f59e0b",
        danger: "#dc2626"
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', '"Bahnschrift"', '"Segoe UI"', "sans-serif"],
        body: ['"Manrope"', '"Trebuchet MS"', '"Segoe UI"', "sans-serif"]
      },
      boxShadow: {
        brand: "0 24px 80px rgba(234,88,12,0.18)"
      }
    }
  },
  plugins: []
};

export default config;
