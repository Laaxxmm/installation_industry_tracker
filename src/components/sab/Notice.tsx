"use client";

import type { ReactNode } from "react";
import { SAB } from "./tokens";

// Inline notice / toast strip — 6px colour dot, hairline border tinted with tone.
// Source: handoff system.jsx · Notice.

type Tone = "positive" | "alert" | "amber" | "blue" | "accent";

const COLOR: Record<Tone, string> = {
  positive: SAB.positive,
  alert: SAB.alert,
  amber: SAB.amber,
  blue: SAB.blue,
  accent: SAB.accent,
};

interface NoticeProps {
  tone?: Tone;
  children: ReactNode;
  onClose?: () => void;
}

export function Notice({ tone = "positive", children, onClose }: NoticeProps) {
  const c = COLOR[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        marginBottom: 14,
        background: `color-mix(in oklch, ${c} 8%, ${SAB.card})`,
        border: `1px solid color-mix(in oklch, ${c} 35%, ${SAB.rule})`,
        borderRadius: 4,
        fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
        fontSize: 12.5,
        color: SAB.ink,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: c,
          flex: "none",
        }}
      />
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: SAB.ink3,
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
