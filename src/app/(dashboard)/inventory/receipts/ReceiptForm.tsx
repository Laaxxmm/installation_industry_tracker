"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { receiveStock } from "@/server/actions/inventory";

export function ReceiptForm({
  materials,
}: {
  materials: Array<{ id: string; label: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    qty: "",
    unitCost: "",
    supplier: "",
    receivedAt: new Date().toISOString().slice(0, 10),
  });

  const materialOptions = useMemo(
    () => materials.map((m) => ({ value: m.id, label: m.label })),
    [materials],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await receiveStock({
          materialId: form.materialId,
          qty: form.qty,
          unitCost: form.unitCost,
          supplier: form.supplier || undefined,
          receivedAt: new Date(`${form.receivedAt}T00:00:00Z`).toISOString(),
        });
        toast.success("Receipt recorded");
        setForm((f) => ({ ...f, qty: "", unitCost: "", supplier: "" }));
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
        <Label htmlFor="unitCost">Unit cost (₹)</Label>
        <Input
          id="unitCost"
          type="number"
          step="0.0001"
          required
          value={form.unitCost}
          onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="supplier">Supplier (optional)</Label>
        <Input
          id="supplier"
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="receivedAt">Received on</Label>
        <Input
          id="receivedAt"
          type="date"
          required
          value={form.receivedAt}
          onChange={(e) => setForm((f) => ({ ...f, receivedAt: e.target.value }))}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !form.materialId}>
        {pending ? "Saving…" : "Record receipt"}
      </Button>
    </form>
  );
}
