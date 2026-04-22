"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMaterialTransfer } from "@/server/actions/transfers";

type InitialTransfer = {
  id: string;
  materialId: string;
  fromProjectId: string;
  toProjectId: string;
  qty: string;
  transferredAt: string;
  note: string | null;
};

export function EditTransferButton({
  transfer,
  materials,
  allProjects,
}: {
  transfer: InitialTransfer;
  materials: Array<{ id: string; label: string }>;
  allProjects: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      materialId: transfer.materialId,
      fromProjectId: transfer.fromProjectId,
      toProjectId: transfer.toProjectId,
      qty: transfer.qty,
      transferredAt: transfer.transferredAt.slice(0, 10),
      note: transfer.note ?? "",
    }),
    [transfer],
  );

  const [form, setForm] = useState(initial);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.label })),
    [materials],
  );
  const projectOptions = useMemo(
    () => allProjects.map((p) => ({ value: p.id, label: p.label })),
    [allProjects],
  );

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.fromProjectId === form.toProjectId) {
      toast.error("From and To must differ");
      return;
    }
    startTransition(async () => {
      try {
        await updateMaterialTransfer(transfer.id, {
          materialId: form.materialId,
          fromProjectId: form.fromProjectId,
          toProjectId: form.toProjectId,
          qty: form.qty,
          transferredAt: new Date(
            `${form.transferredAt}T00:00:00Z`,
          ).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Transfer updated");
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
        title="Edit transfer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit transfer"
        description="Changing qty or material updates both projects' P&L."
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Material</Label>
            <Combobox
              value={form.materialId}
              onChange={(v) => setForm((f) => ({ ...f, materialId: v }))}
              options={materialOptions}
            />
          </div>
          <div>
            <Label>From project</Label>
            <Combobox
              value={form.fromProjectId}
              onChange={(v) => setForm((f) => ({ ...f, fromProjectId: v }))}
              options={projectOptions}
            />
          </div>
          <div>
            <Label>To project</Label>
            <Combobox
              value={form.toProjectId}
              onChange={(v) => setForm((f) => ({ ...f, toProjectId: v }))}
              options={projectOptions}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Qty</Label>
              <Input
                type="number"
                step="0.001"
                required
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={form.transferredAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, transferredAt: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="flex-1"
              disabled={
                pending ||
                !form.materialId ||
                !form.fromProjectId ||
                !form.toProjectId
              }
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
