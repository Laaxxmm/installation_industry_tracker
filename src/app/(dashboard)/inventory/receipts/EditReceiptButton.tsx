"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStockReceipt } from "@/server/actions/inventory";

type InitialReceipt = {
  id: string;
  materialId: string;
  qty: string;
  unitCost: string;
  supplier: string | null;
  receivedAt: string;
  note: string | null;
};

export function EditReceiptButton({
  receipt,
  materials,
}: {
  receipt: InitialReceipt;
  materials: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      materialId: receipt.materialId,
      qty: receipt.qty,
      unitCost: receipt.unitCost,
      supplier: receipt.supplier ?? "",
      receivedAt: receipt.receivedAt.slice(0, 10),
      note: receipt.note ?? "",
    }),
    [receipt],
  );

  const [form, setForm] = useState(initial);

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.label })),
    [materials],
  );

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateStockReceipt(receipt.id, {
          materialId: form.materialId,
          qty: form.qty,
          unitCost: form.unitCost,
          supplier: form.supplier || undefined,
          receivedAt: new Date(`${form.receivedAt}T00:00:00Z`).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Receipt updated");
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
        title="Edit receipt"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit receipt"
        description="Recomputes moving-average cost after save."
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
            <Label>Unit cost (₹)</Label>
            <Input
              type="number"
              step="0.0001"
              required
              value={form.unitCost}
              onChange={(e) =>
                setForm((f) => ({ ...f, unitCost: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Supplier</Label>
            <Input
              value={form.supplier}
              onChange={(e) =>
                setForm((f) => ({ ...f, supplier: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Received on</Label>
            <Input
              type="date"
              required
              value={form.receivedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, receivedAt: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              className="flex-1"
              disabled={pending || !form.materialId}
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
