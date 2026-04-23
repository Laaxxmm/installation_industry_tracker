import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { SAB } from "./tokens";

// 48px top strip above the page content. Shows FY pill + notifications + optional right-side actions.
// Source: handoff shell.jsx · TopBar.

interface TopBarProps {
  title: ReactNode;
  right?: ReactNode;
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <div
      style={{
        height: 48,
        flex: "none",
        borderBottom: `1px solid ${SAB.rule}`,
        background: SAB.card,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          className="sab-caps"
          style={{ fontSize: 10.5, letterSpacing: ".08em" }}
        >
          SAB India
        </div>
        <div style={{ width: 1, height: 14, background: SAB.rule }} />
        <div
          style={{
            fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: SAB.ink,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            border: `1px solid ${SAB.rule}`,
            borderRadius: 4,
            fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
            fontSize: 11,
            color: SAB.ink,
            background: SAB.paperAlt,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 6, background: SAB.positive }} />
          FY 25-26
        </div>
        <button
          type="button"
          aria-label="Notifications"
          style={{
            padding: 7,
            background: "transparent",
            border: `1px solid ${SAB.rule}`,
            borderRadius: 4,
            cursor: "pointer",
            color: SAB.ink3,
            position: "relative",
          }}
        >
          <Icon name="bell" size={14} />
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 6,
              height: 6,
              borderRadius: 6,
              background: SAB.accent,
            }}
          />
        </button>
        {right}
      </div>
    </div>
  );
}
