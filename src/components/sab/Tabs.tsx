"use client";

import type { ReactNode } from "react";
import { SAB } from "./tokens";

// Underline-style tabs — accent underline on active, optional count badge.
// Source: handoff system.jsx · Tabs.

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange?: (key: string) => void;
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange?.(it.key)}
            style={{
              padding: "10px 14px",
              fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? SAB.ink : SAB.ink3,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? SAB.accent : "transparent"}`,
              marginBottom: -1,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                style={{
                  fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background: isActive ? SAB.accentWash : SAB.paperAlt,
                  color: isActive ? SAB.accentInk : SAB.ink3,
                }}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
