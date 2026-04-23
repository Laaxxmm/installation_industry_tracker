import type { ReactNode } from "react";
import { SAB } from "./tokens";

// Editorial page header — eyebrow, display-weight title, optional description, actions + tabs row.
// Source: handoff system.jsx · PageHeader.

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, tabs }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div>
          {eyebrow && (
            <div
              className="sab-eyebrow"
              style={{ fontSize: 10, marginBottom: 6 }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            style={{
              fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
              fontSize: 26,
              fontWeight: 600,
              color: SAB.ink,
              letterSpacing: "-0.025em",
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {title}
          </h1>
          {description && (
            <div
              style={{
                fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
                fontSize: 13,
                color: SAB.ink3,
                marginTop: 6,
                maxWidth: 640,
              }}
            >
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>{actions}</div>
        )}
      </div>
      {tabs && <div style={{ marginTop: 20, borderBottom: `1px solid ${SAB.rule}` }}>{tabs}</div>}
    </div>
  );
}
