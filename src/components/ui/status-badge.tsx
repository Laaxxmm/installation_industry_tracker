import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProjectStatus, TimeEntryStatus } from "@prisma/client";

type Status =
  | ProjectStatus
  | TimeEntryStatus
  | "ACTIVE"
  | "DRAFT"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "OPEN"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PENDING"
  | "PAID"
  | "RECEIVED"
  | "CLOSED";

// SAB editorial status dot. Colors resolve through the SAB oklch tokens defined
// in globals.css (--sab-positive / --sab-amber / --sab-alert / --sab-blue /
// --sab-ink3 / --sab-accent), so dots and foreground stay on the warm-paper
// palette without touching each caller.
const MAP: Record<string, { dot: string; fg: string; label: string }> = {
  // Project
  DRAFT: { dot: "var(--sab-ink3)", fg: "text-[color:var(--sab-ink3)]", label: "Draft" },
  ACTIVE: { dot: "var(--sab-positive)", fg: "text-[color:var(--sab-positive)]", label: "Active" },
  ON_HOLD: { dot: "var(--sab-amber)", fg: "text-[color:var(--sab-amber)]", label: "On hold" },
  COMPLETED: { dot: "var(--sab-accent)", fg: "text-[color:var(--sab-accent-ink)]", label: "Completed" },
  CANCELLED: { dot: "var(--sab-alert)", fg: "text-[color:var(--sab-alert)]", label: "Cancelled" },
  CLOSED: { dot: "var(--sab-ink3)", fg: "text-[color:var(--sab-ink3)]", label: "Closed" },
  // Time entry / approval
  OPEN: { dot: "var(--sab-blue)", fg: "text-[color:var(--sab-blue)]", label: "Open" },
  SUBMITTED: { dot: "var(--sab-amber)", fg: "text-[color:var(--sab-amber)]", label: "Submitted" },
  APPROVED: { dot: "var(--sab-positive)", fg: "text-[color:var(--sab-positive)]", label: "Approved" },
  REJECTED: { dot: "var(--sab-alert)", fg: "text-[color:var(--sab-alert)]", label: "Rejected" },
  // Invoice / payment / receipt
  PENDING: { dot: "var(--sab-amber)", fg: "text-[color:var(--sab-amber)]", label: "Pending" },
  PAID: { dot: "var(--sab-positive)", fg: "text-[color:var(--sab-positive)]", label: "Paid" },
  RECEIVED: { dot: "var(--sab-positive)", fg: "text-[color:var(--sab-positive)]", label: "Received" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status | string;
  className?: string;
}) {
  const s =
    MAP[status] ??
    {
      dot: "var(--sab-ink3)",
      fg: "text-[color:var(--sab-ink3)]",
      label: status,
    };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium",
        s.fg,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}
