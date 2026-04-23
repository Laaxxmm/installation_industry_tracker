"use client";

import { useFormStatus } from "react-dom";
import { SAB } from "./tokens";

// Sign-out button rendered inside the sign-out <form>. Uses useFormStatus so it dims while
// the server action is in flight. Kept as a separate client component so the dashboard
// layout can stay a server component.
export function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: "5px 12px",
        background: "transparent",
        border: `1px solid ${SAB.rule}`,
        borderRadius: 4,
        fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        color: SAB.ink2,
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
