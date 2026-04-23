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
  | "REJECTED";

const MAP: Record<string, { dot: string; fg: string; label: string }> = {
  // Project
  DRAFT: { dot: "#64748B", fg: "text-slate-600", label: "Draft" },
  ACTIVE: { dot: "#059669", fg: "text-emerald-700", label: "Active" },
  ON_HOLD: { dot: "#D97706", fg: "text-amber-700", label: "On hold" },
  COMPLETED: { dot: "#0B5CAD", fg: "text-brand", label: "Completed" },
  CANCELLED: { dot: "#DC2626", fg: "text-red-700", label: "Cancelled" },
  // Time entry
  OPEN: { dot: "#0EA5E9", fg: "text-sky-700", label: "Open" },
  SUBMITTED: { dot: "#D97706", fg: "text-amber-700", label: "Submitted" },
  APPROVED: { dot: "#059669", fg: "text-emerald-700", label: "Approved" },
  REJECTED: { dot: "#DC2626", fg: "text-red-700", label: "Rejected" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status | string;
  className?: string;
}) {
  const s = MAP[status] ?? { dot: "#64748B", fg: "text-slate-600", label: status };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium",
        s.fg,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: s.dot }}
      />
      {s.label}
    </span>
  );
}
