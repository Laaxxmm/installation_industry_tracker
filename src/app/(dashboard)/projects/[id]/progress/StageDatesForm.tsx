"use client";

import { useState, useTransition } from "react";
import { ProjectStageKey } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateStageDates } from "@/server/actions/progress";

function toIsoOrNull(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

export function StageDatesForm({
  projectId,
  stageKey,
  initial,
}: {
  projectId: string;
  stageKey: ProjectStageKey;
  initial: { plannedStart: string; plannedEnd: string; notes: string };
}) {
  const [plannedStart, setPlannedStart] = useState(initial.plannedStart);
  const [plannedEnd, setPlannedEnd] = useState(initial.plannedEnd);
  const [notes, setNotes] = useState(initial.notes);
  const [isPending, startTransition] = useTransition();

  const dirty =
    plannedStart !== initial.plannedStart ||
    plannedEnd !== initial.plannedEnd ||
    notes !== initial.notes;

  const submit = () => {
    startTransition(async () => {
      try {
        await updateStageDates({
          projectId,
          stageKey,
          plannedStart: toIsoOrNull(plannedStart),
          plannedEnd: toIsoOrNull(plannedEnd),
          notes: notes || undefined,
        });
        toast.success("Stage updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 text-[11px]">
      <label className="flex flex-col gap-1">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Planned start
        </span>
        <input
          type="date"
          value={plannedStart}
          onChange={(e) => setPlannedStart(e.target.value)}
          className="h-8 rounded border border-slate-300 px-2 text-[12px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Planned end
        </span>
        <input
          type="date"
          value={plannedEnd}
          onChange={(e) => setPlannedEnd(e.target.value)}
          className="h-8 rounded border border-slate-300 px-2 text-[12px]"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 min-w-[160px]">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Notes
        </span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
          className="h-8 rounded border border-slate-300 px-2 text-[12px]"
        />
      </label>
      <Button
        size="sm"
        variant={dirty ? "default" : "outline"}
        onClick={submit}
        disabled={!dirty || isPending}
      >
        Save dates
      </Button>
    </div>
  );
}
