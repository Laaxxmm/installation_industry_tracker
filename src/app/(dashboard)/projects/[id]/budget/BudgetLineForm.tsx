"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { upsertBudgetLine } from "@/server/actions/budgets";

type MaterialOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  avgUnitCost: string;
};

export function BudgetLineForm({
  projectId,
  materials,
}: {
  projectId: string;
  materials: MaterialOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: "MATERIAL" as "MATERIAL" | "LABOR" | "OTHER",
    description: "",
    materialId: "",
    quantity: "",
    unitCost: "",
  });

  function pickMaterial(materialId: string) {
    if (!materialId) {
      setForm((f) => ({ ...f, materialId: "" }));
      return;
    }
    const m = materials.find((x) => x.id === materialId);
    if (!m) return;
    setForm((f) => ({
      ...f,
      materialId,
      // Pre-fill description with the material name if blank, so the line
      // is informative without forcing the user to retype. They can edit.
      description: f.description || `${m.sku} · ${m.name}`,
      // Pre-fill unit cost from the moving average if blank.
      unitCost: f.unitCost || m.avgUnitCost,
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertBudgetLine({
          projectId,
          category: form.category,
          description: form.description,
          materialId: form.materialId || null,
          quantity: form.quantity,
          unitCost: form.unitCost,
        });
        toast.success(
          form.materialId
            ? "Budget line saved (linked to material)"
            : "Budget line saved",
        );
        setForm({
          category: "MATERIAL",
          description: "",
          materialId: "",
          quantity: "",
          unitCost: "",
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const isMaterial = form.category === "MATERIAL";

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-6 md:items-end">
      <div>
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              category: e.target.value as typeof f.category,
              // Switching away from MATERIAL clears the link.
              materialId:
                e.target.value === "MATERIAL" ? f.materialId : "",
            }))
          }
        >
          <option value="MATERIAL">Material</option>
          <option value="LABOR">Labor</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      {isMaterial && (
        <div className="md:col-span-2">
          <Label htmlFor="material">
            Material <span className="font-normal text-slate-500">(optional, enables auto-approval)</span>
          </Label>
          <Select
            id="material"
            value={form.materialId}
            onChange={(e) => pickMaterial(e.target.value)}
          >
            <option value="">— Free-text only —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.sku} · {m.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className={isMaterial ? "md:col-span-3" : "md:col-span-2"}>
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
      <div className="md:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add line"}
        </Button>
      </div>
    </form>
  );
}
