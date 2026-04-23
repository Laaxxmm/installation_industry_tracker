import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          hover: "hsl(var(--brand-hover))",
          foreground: "hsl(var(--brand-foreground))",
          50: "#EFF5FC",
          100: "#D8E6F7",
          200: "#B2CEEF",
          300: "#7FADE2",
          400: "#4A8BD0",
          500: "#0B5CAD",
          600: "#084A91",
          700: "#063A73",
          800: "#052C58",
          900: "#031E3D",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "#FFFFFF",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "#FFFFFF",
        },
        // Claude-Design tokens — warm paper, ink, signal orange.
        // Values in oklch; reference via `bg-sab-paper`, `text-sab-ink`, etc.
        sab: {
          paper: "oklch(0.985 0.003 80)",
          "paper-alt": "oklch(0.975 0.004 80)",
          ink: "oklch(0.22 0.01 60)",
          "ink-2": "oklch(0.38 0.01 60)",
          "ink-3": "oklch(0.55 0.01 60)",
          "ink-4": "oklch(0.72 0.008 60)",
          rule: "oklch(0.92 0.005 80)",
          "rule-strong": "oklch(0.86 0.006 80)",
          card: "#ffffff",
          accent: "oklch(0.68 0.16 45)",
          "accent-ink": "oklch(0.42 0.14 45)",
          "accent-wash": "oklch(0.965 0.022 55)",
          positive: "oklch(0.58 0.11 155)",
          "positive-wash": "oklch(0.96 0.03 155)",
          alert: "oklch(0.58 0.18 25)",
          "alert-wash": "oklch(0.965 0.04 25)",
          amber: "oklch(0.74 0.14 78)",
          "amber-wash": "oklch(0.97 0.04 85)",
          blue: "oklch(0.56 0.12 240)",
          "blue-wash": "oklch(0.965 0.02 240)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        // Claude-Design "Industrial Operations" — warm paper + signal orange.
        // Mobile shell opts in via `font-sab-sans`; desktop stays on system-ui.
        "sab-sans": ["var(--font-sab-sans)", "Inter Tight", "Inter", "system-ui", "sans-serif"],
        "sab-mono": ["var(--font-sab-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.06)",
        "card-lg":
          "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 4px 8px 0 rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
