import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
  sub?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
  className?: string;
}

/**
 * Executive Sapphire KPI card.
 *
 * - Uppercase eyebrow label (10px tracking-wider slate-500)
 * - Large value (24px, semibold, tabular-nums)
 * - Optional sparkline on the right
 * - Optional delta with arrow icon + "vs last period"-style subtitle
 */
export function StatCard({
  label,
  value,
  delta,
  deltaDirection = "flat",
  sub,
  spark,
  sparkColor,
  className,
}: StatCardProps) {
  const up = deltaDirection === "up";
  const down = deltaDirection === "down";
  const color = up ? "#059669" : down ? "#DC2626" : "#64748B";
  return (
    <div
      className={cn(
        "rounded-md border border-slate-200 bg-white p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="mt-2 truncate text-[22px] font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
        </div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? color} />
        )}
      </div>
      {(delta || sub) && (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          {delta ? (
            <div
              className={cn(
                "flex items-center gap-1 font-semibold tabular-nums",
                up && "text-emerald-700",
                down && "text-red-700",
                !up && !down && "text-slate-600",
              )}
            >
              {up && <ArrowUpRight className="h-3 w-3" />}
              {down && <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </div>
          ) : (
            <span />
          )}
          {sub && <span className="text-slate-500">{sub}</span>}
        </div>
      )}
    </div>
  );
}
