// Colour tokens ported from the Claude-Design handoff system.jsx.
// Tailwind `bg-sab-*` / `text-sab-*` classes are the primary way to
// use these; this file is for inline styles where a class won't do
// (e.g. SVG `fill`, dynamic palette switching in the punch widget).

export const SAB = {
  paper: "oklch(0.985 0.003 80)",
  paperAlt: "oklch(0.975 0.004 80)",
  ink: "oklch(0.22 0.01 60)",
  ink2: "oklch(0.38 0.01 60)",
  ink3: "oklch(0.55 0.01 60)",
  ink4: "oklch(0.72 0.008 60)",
  rule: "oklch(0.92 0.005 80)",
  ruleStrong: "oklch(0.86 0.006 80)",
  card: "#ffffff",
  accent: "oklch(0.68 0.16 45)",
  accentInk: "oklch(0.42 0.14 45)",
  accentWash: "oklch(0.965 0.022 55)",
  positive: "oklch(0.58 0.11 155)",
  positiveWash: "oklch(0.96 0.03 155)",
  alert: "oklch(0.58 0.18 25)",
  alertWash: "oklch(0.965 0.04 25)",
  amber: "oklch(0.74 0.14 78)",
  amberWash: "oklch(0.97 0.04 85)",
  blue: "oklch(0.56 0.12 240)",
  blueWash: "oklch(0.965 0.02 240)",
} as const;

export type SabToken = keyof typeof SAB;
