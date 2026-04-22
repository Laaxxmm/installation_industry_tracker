"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { upsertBudgetLine } from "@/server/actions/budgets";

export function BudgetLineForm({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: "MATERIAL" as "MATERIAL" | "LABOR" | "OTHER",
    description: "",
    quantity: "",
    unitCost: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertBudgetLine({
          projectId,
          category: form.category,
          description: form.description,
          quantity: form.quantity,
          unitCost: form.unitCost,
        });
        toast.success("Budget line saved");
        setForm({ category: "MATERIAL", description: "", quantity: "", unitCost: "" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-5 md:items-end">
      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({ ...f, category: e.target.value as typeof f.category }))
          }
        >
          <option value="MATERIAL">Material</option>
          <option value="LABOR">Labor</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
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
        <Label htmlFor="quantity">Qty</Label>
        <Input
          id="quantity"
          type="number"
          step="0.001"
          required
          value={form.quantity}
          onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
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
      <div className="md:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add line"}
        </Button>
      </div>
    </form>
  );
}
