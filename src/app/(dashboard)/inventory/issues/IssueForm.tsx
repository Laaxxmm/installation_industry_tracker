"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { issueStock } from "@/server/actions/inventory";

export function IssueForm({
  materials,
  projects,
}: {
  materials: Array<{ id: string; label: string; onHand: string }>;
  projects: Array<{ id: string; code: string; name: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    projectId: projects[0]?.id ?? "",
    qty: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const selected = materials.find((m) => m.id === form.materialId);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.label })),
    [materials],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [projects],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await issueStock({
          materialId: form.materialId,
          projectId: form.projectId,
          qty: form.qty,
          issuedAt: new Date(`${form.issuedAt}T00:00:00Z`).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Issue recorded");
        setForm((f) => ({ ...f, qty: "", note: "" }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="materialId">Material</Label>
        <Combobox
          id="materialId"
          value={form.materialId}
          onChange={(v) => setForm((f) => ({ ...f, materialId: v }))}
          options={materialOptions}
          placeholder="Select material…"
        />
        {selected && (
          <p className="text-xs text-muted-foreground mt-1">On hand: {selected.onHand}</p>
        )}
      </div>
      <div>
        <Label htmlFor="projectId">Project</Label>
        <Combobox
          id="projectId"
          value={form.projectId}
          onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
          options={projectOptions}
          placeholder="Select project…"
        />
      </div>
      <div>
        <Label htmlFor="qty">Quantity</Label>
        <Input
          id="qty"
          type="number"
          step="0.001"
          required
          value={form.qty}
          onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="issuedAt">Issued on</Label>
        <Input
          id="issuedAt"
          type="date"
          required
          value={form.issuedAt}
          onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !form.materialId || !form.projectId}>
        {pending ? "Saving…" : "Record issue"}
      </Button>
    </form>
  );
}
