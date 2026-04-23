import type { Decimal } from "decimal.js";
import { ProjectStageKey } from "@prisma/client";
import { cn } from "@/lib/utils";

type StageSummary = {
  stageKey: ProjectStageKey;
  label: string;
  stage: {
    plannedStart: Date | null;
    plannedEnd: Date | null;
    actualStart: Date | null;
    actualEnd: Date | null;
  };
  percent: Decimal;
};

/**
 * Horizontal 5-stage progress strip. Each cell shows its label + percent fill.
 */
export function StageStrip({ stages }: { stages: StageSummary[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Stage flow
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {stages.map((s, i) => {
          const pct = Number(s.percent.toString());
          const done = pct >= 100;
          const active = !done && pct > 0;
          const pending = pct === 0;
          return (
            <div
              key={s.stageKey}
              className={cn(
                "relative overflow-hidden rounded-md border px-3 py-2.5",
                done && "border-emerald-300 bg-emerald-50",
                active && "border-sky-300 bg-sky-50",
                pending && "border-slate-200 bg-slate-50",
              )}
            >
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <span>Stage {i + 1}</span>
                <span className="tabular-nums text-slate-700">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 text-[13px] font-semibold",
                  done && "text-emerald-900",
                  active && "text-sky-900",
                  pending && "text-slate-700",
                )}
              >
                {s.label}
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    done && "bg-emerald-500",
                    active && "bg-sky-500",
                    pending && "bg-slate-300",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
