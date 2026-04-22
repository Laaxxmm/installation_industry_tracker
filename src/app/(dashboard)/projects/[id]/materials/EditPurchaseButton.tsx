"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateDirectPurchase } from "@/server/actions/purchases";

type InitialPurchase = {
  id: string;
  projectId: string;
  description: string;
  qty: string;
  unitCost: string;
  supplier: string | null;
  invoiceRef: string | null;
  purchasedAt: string;
  category: "MATERIAL" | "OTHER";
};

export function EditPurchaseButton({ purchase }: { purchase: InitialPurchase }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      description: purchase.description,
      qty: purchase.qty,
      unitCost: purchase.unitCost,
      supplier: purchase.supplier ?? "",
      invoiceRef: purchase.invoiceRef ?? "",
      purchasedAt: purchase.purchasedAt.slice(0, 10),
      category: purchase.category,
    }),
    [purchase],
  );

  const [form, setForm] = useState(initial);

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateDirectPurchase(purchase.id, {
          projectId: purchase.projectId,
          description: form.description,
          qty: form.qty,
          unitCost: form.unitCost,
          supplier: form.supplier || undefined,
          invoiceRef: form.invoiceRef || undefined,
          category: form.category,
          purchasedAt: new Date(
            `${form.purchasedAt}T00:00:00Z`,
          ).toISOString(),
        });
        toast.success("Purchase updated");
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
        title="Edit purchase"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={onOpenChange} title="Edit direct purchase">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Description</Label>
            <Input
              required
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as typeof f.category,
                  }))
                }
              >
                <option value="MATERIAL">Material</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={form.purchasedAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purchasedAt: e.target.value }))
                }
              />
            </div>
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
              <Label>Unit cost (₹)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={form.unitCost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitCost: e.target.value }))
                }
              />
            </div>
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
            <Label>Invoice #</Label>
            <Input
              value={form.invoiceRef}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoiceRef: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={pending}>
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
