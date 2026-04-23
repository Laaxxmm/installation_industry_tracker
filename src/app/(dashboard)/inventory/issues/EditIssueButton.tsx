"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStockIssue } from "@/server/actions/inventory";

type InitialIssue = {
  id: string;
  materialId: string;
  projectId: string;
  qty: string;
  issuedAt: string;
  note: string | null;
};

export function EditIssueButton({
  issue,
  materials,
  projects,
}: {
  issue: InitialIssue;
  materials: Array<{ id: string; label: string }>;
  projects: Array<{ id: string; code: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      materialId: issue.materialId,
      projectId: issue.projectId,
      qty: issue.qty,
      issuedAt: issue.issuedAt.slice(0, 10),
      note: issue.note ?? "",
    }),
    [issue],
  );

  const [form, setForm] = useState(initial);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.label })),
    [materials],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [projects],
  );

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateStockIssue(issue.id, {
          materialId: form.materialId,
          projectId: form.projectId,
          qty: form.qty,
          issuedAt: new Date(`${form.issuedAt}T00:00:00Z`).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Issue updated");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand"
        title="Edit issue"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit issue"
        description="Snapshots current moving-avg cost on save."
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Material</Label>
            <Combobox
              value={form.materialId}
              onChange={(v) => setForm((f) => ({ ...f, materialId: v }))}
              options={materialOptions}
              placeholder="Select material…"
            />
          </div>
          <div>
            <Label>Project</Label>
            <Combobox
              value={form.projectId}
              onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
              options={projectOptions}
              placeholder="Select project…"
            />
          </div>
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              step="0.001"
              required
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </div>
          <div>
            <Label>Issued on</Label>
            <Input
              type="date"
              required
              value={form.issuedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, issuedAt: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="flex-1"
              disabled={pending || !form.materialId || !form.projectId}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
