"use client";

import { useState, useTransition } from "react";
import { ProjectStageKey } from "@prisma/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { upsertMilestone } from "@/server/actions/progress";

function toIsoOrNull(dateStr: string): string | null {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

export function NewMilestoneForm({
  projectId,
  stageKey,
  nextSortOrder,
}: {
  projectId: string;
  stageKey: ProjectStageKey;
  nextSortOrder: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("1");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setWeight("1");
    setPlannedStart("");
    setPlannedEnd("");
    setOpen(false);
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    startTransition(async () => {
      try {
        await upsertMilestone({
          projectId,
          stageKey,
          sortOrder: nextSortOrder,
          name: name.trim(),
          weight,
          plannedStart: toIsoOrNull(plannedStart),
          plannedEnd: toIsoOrNull(plannedEnd),
        });
        toast.success("Milestone added");
        reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Add failed");
      }
    });
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Plus className="h-3.5 w-3.5" /> Add milestone
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px]">
      <div className="grid gap-2 md:grid-cols-[2fr,1fr,1fr,1fr,auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Milestone name"
          className="h-8"
          autoFocus
        />
        <Input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight"
          className="h-8 tabular-nums"
        />
        <Input
          type="date"
          value={plannedStart}
          onChange={(e) => setPlannedStart(e.target.value)}
          className="h-8"
        />
        <Input
          type="date"
          value={plannedEnd}
          onChange={(e) => setPlannedEnd(e.target.value)}
          className="h-8"
        />
        <div className="flex gap-1">
          <Button size="sm" onClick={submit} disabled={isPending}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
