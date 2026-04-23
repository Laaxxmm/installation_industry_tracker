"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { upsertOverhead } from "@/server/actions/overhead";

type ProjectOpt = { id: string; code: string; name: string };

export function OverheadForm({ projects }: { projects: ProjectOpt[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    periodMonth: new Date().toISOString().slice(0, 7), // yyyy-MM
    amount: "",
    note: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) {
      toast.error("Pick a project");
      return;
    }
    startTransition(async () => {
      try {
        await upsertOverhead({
          projectId: form.projectId,
          periodMonth: new Date(`${form.periodMonth}-01T00:00:00Z`).toISOString(),
          amount: form.amount,
          note: form.note || undefined,
        });
        toast.success("Overhead saved");
        setForm((f) => ({ ...f, amount: "", note: "" }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4 md:items-end">
      <div className="md:col-span-2">
        <Label htmlFor="projectId">Project</Label>
        <Select
          id="projectId"
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="periodMonth">Month</Label>
        <Input
          id="periodMonth"
          type="month"
          required
          value={form.periodMonth}
          onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
      </div>
      <div className="md:col-span-4">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          rows={2}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </div>
      <div className="md:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save overhead"}
        </Button>
        <span className="ml-3 text-xs text-muted-foreground">
          Re-submitting the same (project, month) replaces the previous amount.
        </span>
      </div>
    </form>
  );
}
