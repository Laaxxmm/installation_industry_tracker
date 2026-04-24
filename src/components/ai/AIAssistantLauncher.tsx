"use client";

import { useState } from "react";
import { Icon } from "@/components/sab/Icon";
import { SAB } from "@/components/sab/tokens";
import { AIAssistantPanel } from "./AIAssistantPanel";

// Floating bottom-right launcher rendered once by the dashboard layout.
// When AI_ENABLED=false (checked server-side before this mounts), the
// launcher is not rendered at all — keeps the dashboard clean when the
// agent is gated off.

export function AIAssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 70,
          width: 48,
          height: 48,
          borderRadius: 24,
          background: SAB.accent,
          color: "#fff",
          border: "none",
          boxShadow: "0 10px 24px rgba(217,119,87,.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .12s",
        }}
      >
        <Icon name={open ? "x" : "lightning"} size={18} />
      </button>
      <AIAssistantPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
