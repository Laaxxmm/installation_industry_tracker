"use client";

import { useState, useTransition } from "react";
import { ProjectStageKey } from "@prisma/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  deleteMilestone,
  updateMilestonePercent,
  upsertMilestone,
} from "@/server/actions/progress";

type MilestoneView = {
  id: string;
  name: string;
  percentComplete: string;
  weight: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  updatedAt: string;
  updatedByName: string | null;
};

const STATUS_PILL: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  DONE: "bg-emerald-100 text-emerald-800",
  BLOCKED: "bg-red-100 text-red-800",
};

const QUICK_PERCENTS = [0, 25, 50, 75, 100];

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toIsoOrNull(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

export function MilestoneRow({
  milestone,
  projectId,
  stageKey,
  canEdit,
}: {
  milestone: MilestoneView;
  projectId: string;
  stageKey: ProjectStageKey;
  canEdit: boolean;
}) {
  const [pct, setPct] = useState(milestone.percentComplete);
  const [status, setStatus] = useState(milestone.status);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(milestone.name);
  const [weight, setWeight] = useState(milestone.weight);
  const [plannedStart, setPlannedStart] = useState(
    toDateInput(milestone.plannedStart),
  );
  const [plannedEnd, setPlannedEnd] = useState(toDateInput(milestone.plannedEnd));
  const [isPending, startTransition] = useTransition();

  const overdue =
    status !== "DONE" &&
    milestone.plannedEnd !== null &&
    new Date(milestone.plannedEnd).getTime() < Date.now();

  const submitPercent = (nextPct: string, nextStatus?: string) => {
    startTransition(async () => {
      try {
        await updateMilestonePercent({
          milestoneId: milestone.id,
          percentComplete: nextPct,
          status: nextStatus,
        });
        toast.success("Progress updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  const saveHeader = () => {
    startTransition(async () => {
      try {
        await upsertMilestone({
          id: milestone.id,
          projectId,
          stageKey,
          name,
          weight,
          plannedStart: toIsoOrNull(plannedStart),
          plannedEnd: toIsoOrNull(plannedEnd),
          sortOrder: 0,
        });
        toast.success("Milestone updated");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  const remove = () => {
    if (!confirm(`Delete milestone "${milestone.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteMilestone(milestone.id);
        toast.success("Milestone deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  return (
    <div
      className={cn(
        "px-4 py-3 text-[13px]",
        overdue && "bg-red-50/40",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Milestone name"
              className="h-8 text-[13px]"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">
                {milestone.name}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  STATUS_PILL[status] ?? "bg-slate-100 text-slate-700",
                )}
              >
                {status.replace("_", " ")}
              </span>
              {overdue && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                  Overdue
                </span>
              )}
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-500">
            {editing ? (
              <div className="flex flex-wrap gap-2">
                <label className="text-[11px]">
                  <span className="mr-1">Weight</span>
                  <input
                    className="h-7 w-16 rounded border border-slate-300 px-2 text-[12px] tabular-nums"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </label>
                <label className="text-[11px]">
                  <span className="mr-1">Start</span>
                  <input
                    type="date"
                    className="h-7 rounded border border-slate-300 px-2 text-[12px]"
                    value={plannedStart}
                    onChange={(e) => setPlannedStart(e.target.value)}
                  />
                </label>
                <label className="text-[11px]">
                  <span className="mr-1">End</span>
                  <input
                    type="date"
                    className="h-7 rounded border border-slate-300 px-2 text-[12px]"
                    value={plannedEnd}
                    onChange={(e) => setPlannedEnd(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <>
                Weight {milestone.weight}
                {milestone.plannedStart && (
                  <>
                    {" · "}
                    {toDateInput(milestone.plannedStart)}
                  </>
                )}
                {milestone.plannedEnd && (
                  <>
                    {" → "}
                    {toDateInput(milestone.plannedEnd)}
                  </>
                )}
                {milestone.updatedByName && (
                  <>
                    <span className="mx-1">·</span>
                    Updated by {milestone.updatedByName}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
            {QUICK_PERCENTS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!canEdit || isPending}
                onClick={() => {
                  setPct(String(p));
                  submitPercent(String(p));
                }}
                className={cn(
                  "rounded px-2 py-1 text-[11px] font-semibold tabular-nums transition",
                  Number(pct) === p
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            max={100}
            step="1"
            value={pct}
            disabled={!canEdit || isPending}
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => {
              if (pct !== milestone.percentComplete) submitPercent(pct);
            }}
            className="h-8 w-16 rounded border border-slate-300 px-2 text-right text-[12px] tabular-nums"
          />
          <span className="text-[11px] text-slate-500">%</span>
          {canEdit && (
            <Select
              value={status}
              onChange={(e) => {
                const v = e.target.value;
                setStatus(v);
                submitPercent(pct, v);
              }}
              disabled={isPending}
              className="h-8 w-[130px] text-[12px]"
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
          )}
          {canEdit && !editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              disabled={isPending}
            >
              Edit
            </Button>
          )}
          {canEdit && editing && (
            <>
              <Button size="sm" onClick={saveHeader} disabled={isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName(milestone.name);
                  setWeight(milestone.weight);
                  setPlannedStart(toDateInput(milestone.plannedStart));
                  setPlannedEnd(toDateInput(milestone.plannedEnd));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
          {canEdit && !editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={isPending}
              aria-label="Delete milestone"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
