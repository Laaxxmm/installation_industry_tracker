"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createMaterialTransfer } from "@/server/actions/transfers";

type Option = { id: string; label: string };

export function TransferForm({
  fromProjectId,
  materials,
  otherProjects,
}: {
  fromProjectId: string;
  materials: Option[];
  otherProjects: Option[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    toProjectId: otherProjects[0]?.id ?? "",
    qty: "",
    transferredAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.materialId || !form.toProjectId) {
      toast.error("Pick material and destination");
      return;
    }
    startTransition(async () => {
      try {
        await createMaterialTransfer({
          materialId: form.materialId,
          fromProjectId,
          toProjectId: form.toProjectId,
          qty: form.qty,
          transferredAt: new Date(`${form.transferredAt}T00:00:00Z`).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Transfer recorded");
        setForm((f) => ({ ...f, qty: "", note: "" }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  if (otherProjects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No other projects available to transfer to.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4 md:items-end">
      <div>
        <Label htmlFor="materialId">Material</Label>
        <Select
          id="materialId"
          value={form.materialId}
          onChange={(e) => setForm((f) => ({ ...f, materialId: e.target.value }))}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="toProjectId">To project</Label>
        <Select
          id="toProjectId"
          value={form.toProjectId}
          onChange={(e) => setForm((f) => ({ ...f, toProjectId: e.target.value }))}
        >
          {otherProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
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
        <Label htmlFor="transferredAt">Date</Label>
        <Input
          id="transferredAt"
          type="date"
          required
          value={form.transferredAt}
          onChange={(e) => setForm((f) => ({ ...f, transferredAt: e.target.value }))}
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
          {pending ? "Saving…" : "Record transfer"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Transfers out reduce this project's material cost and add to the destination project
          at the material's current moving-average unit cost.
        </p>
      </div>
    </form>
  );
}
