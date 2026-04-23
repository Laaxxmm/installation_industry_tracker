"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createDirectPurchase } from "@/server/actions/purchases";

export function DirectPurchaseForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    description: "",
    qty: "",
    unitCost: "",
    supplier: "",
    purchasedAt: new Date().toISOString().slice(0, 10),
    category: "MATERIAL" as "MATERIAL" | "OTHER",
    invoiceRef: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createDirectPurchase({
          projectId,
          description: form.description,
          qty: form.qty,
          unitCost: form.unitCost,
          supplier: form.supplier || undefined,
          invoiceRef: form.invoiceRef || undefined,
          category: form.category,
          purchasedAt: new Date(`${form.purchasedAt}T00:00:00Z`).toISOString(),
        });
        toast.success("Purchase booked");
        setForm((f) => ({ ...f, description: "", qty: "", unitCost: "", supplier: "", invoiceRef: "" }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4 md:items-end">
      <div className="md:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          required
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))}
        >
          <option value="MATERIAL">Material</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="purchasedAt">Date</Label>
        <Input
          id="purchasedAt"
          type="date"
          required
          value={form.purchasedAt}
          onChange={(e) => setForm((f) => ({ ...f, purchasedAt: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="qty">Qty</Label>
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
          step="0.01"
          required
          value={form.unitCost}
          onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="supplier">Supplier</Label>
        <Input
          id="supplier"
          value={form.supplier}
          onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="invoiceRef">Invoice #</Label>
        <Input
          id="invoiceRef"
          value={form.invoiceRef}
          onChange={(e) => setForm((f) => ({ ...f, invoiceRef: e.target.value }))}
        />
      </div>
      <div className="md:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Book purchase"}
        </Button>
      </div>
    </form>
  );
}
