import { QuoteStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const MAP: Record<QuoteStatus, { dot: string; fg: string; label: string }> = {
  DRAFT: { dot: "#64748B", fg: "text-slate-600", label: "Draft" },
  SENT: { dot: "#0B5CAD", fg: "text-brand", label: "Sent" },
  CHANGES_REQUESTED: {
    dot: "#D97706",
    fg: "text-amber-700",
    label: "Changes requested",
  },
  REVISED: { dot: "#7C3AED", fg: "text-violet-700", label: "Revised" },
  NEGOTIATING: { dot: "#F59E0B", fg: "text-amber-700", label: "Negotiating" },
  ACCEPTED: { dot: "#059669", fg: "text-emerald-700", label: "Accepted" },
  CONVERTED: { dot: "#0EA5E9", fg: "text-sky-700", label: "Converted" },
  LOST: { dot: "#DC2626", fg: "text-red-700", label: "Lost" },
  EXPIRED: { dot: "#94A3B8", fg: "text-slate-500", label: "Expired" },
};

export function QuoteStatusPill({
  status,
  className,
}: {
  status: QuoteStatus;
  className?: string;
}) {
  const s = MAP[status];
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
