"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createIndent, submitIndent } from "@/server/actions/indents";

type ProjectOption = { id: string; code: string; name: string };
type MaterialOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  onHandQty: string;
  avgUnitCost: string;
};

type Line = {
  // Local row id for React key — not the eventual DB id.
  rowId: string;
  materialId: string;
  requestedQty: string;
  notes: string;
};

function newRowId() {
  return Math.random().toString(36).slice(2, 10);
}

export function NewIndentForm({
  projects,
  materials,
  preselectedProjectId,
}: {
  projects: ProjectOption[];
  materials: MaterialOption[];
  preselectedProjectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(preselectedProjectId ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { rowId: newRowId(), materialId: "", requestedQty: "", notes: "" },
  ]);

  const materialById = useMemo(() => {
    const m = new Map<string, MaterialOption>();
    for (const x of materials) m.set(x.id, x);
    return m;
  }, [materials]);

  const totalValue = useMemo(() => {
    return lines.reduce((sum, l) => {
      const m = materialById.get(l.materialId);
      if (!m || !l.requestedQty) return sum;
      const q = Number(l.requestedQty);
      const c = Number(m.avgUnitCost);
      if (!Number.isFinite(q) || !Number.isFinite(c)) return sum;
      return sum + q * c;
    }, 0);
  }, [lines, materialById]);

  function updateLine(rowId: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.rowId === rowId ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { rowId: newRowId(), materialId: "", requestedQty: "", notes: "" },
    ]);
  }

  function removeLine(rowId: string) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.rowId !== rowId),
    );
  }

  function validate(): string | null {
    if (!projectId) return "Pick a project.";
    if (lines.length === 0) return "Add at least one line item.";
    for (const [i, l] of lines.entries()) {
      if (!l.materialId) return `Line ${i + 1}: pick a material.`;
      if (!l.requestedQty) return `Line ${i + 1}: enter quantity.`;
      const q = Number(l.requestedQty);
      if (!Number.isFinite(q) || q <= 0)
        return `Line ${i + 1}: quantity must be a positive number.`;
    }
    // No duplicate materialIds — collapse to single line if needed.
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.materialId)) {
        const m = materialById.get(l.materialId);
        return `Material ${m?.sku ?? l.materialId} appears on more than one line — combine into a single line.`;
      }
      seen.add(l.materialId);
    }
    return null;
  }

  async function saveDraft() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      try {
        const { id, indentNo } = await createIndent({
          projectId,
          notes: notes || null,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: l.requestedQty,
            notes: l.notes || null,
          })),
        });
        toast.success(`Saved as draft: ${indentNo}`);
        router.push(`/indents/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save draft");
      }
    });
  }

  async function saveAndSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      try {
        const { id, indentNo } = await createIndent({
          projectId,
          notes: notes || null,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            requestedQty: l.requestedQty,
            notes: l.notes || null,
          })),
        });
        await submitIndent(id);
        toast.success(`Submitted ${indentNo}`);
        router.push(`/indents/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="project">Project</Label>
        <select
          id="project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="flex h-9 w-full rounded border border-[hsl(var(--border))] bg-white px-3 py-1.5 text-[13px] text-[hsl(var(--foreground))]"
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Line items</Label>
        <div className="space-y-2">
          {lines.map((l, idx) => {
            const m = l.materialId ? materialById.get(l.materialId) : undefined;
            const reqQty = Number(l.requestedQty);
            const insufficient =
              m && Number.isFinite(reqQty) && reqQty > Number(m.onHandQty);
            return (
              <div
                key={l.rowId}
                className="grid grid-cols-12 items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2"
              >
                <div className="col-span-1 pt-2 text-center text-[11px] font-mono text-slate-500">
                  {idx + 1}
                </div>
                <div className="col-span-5">
                  <select
                    value={l.materialId}
                    onChange={(e) => updateLine(l.rowId, { materialId: e.target.value })}
                    className="flex h-9 w-full rounded border border-slate-200 bg-white px-2 text-[12px]"
                  >
                    <option value="">Pick material…</option>
                    {materials.map((mm) => (
                      <option key={mm.id} value={mm.id}>
                        {mm.sku} · {mm.name}
                      </option>
                    ))}
                  </select>
                  {m && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Unit: {m.unit} · On hand: {m.onHandQty} · Avg cost: ₹{m.avgUnitCost}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    placeholder="Qty"
                    value={l.requestedQty}
                    onChange={(e) => updateLine(l.rowId, { requestedQty: e.target.value })}
                    className="text-right"
                  />
                  {insufficient && (
                    <div className="mt-1 text-[11px] text-amber-700">
                      ⚠ Stock insufficient (have {m?.onHandQty})
                    </div>
                  )}
                </div>
                <div className="col-span-3">
                  <Input
                    type="text"
                    placeholder="Notes (optional)"
                    value={l.notes}
                    onChange={(e) => updateLine(l.rowId, { notes: e.target.value })}
                  />
                </div>
                <div className="col-span-1 pt-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(l.rowId)}
                    disabled={lines.length === 1}
                    aria-label="Remove line"
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLine}
          className="mt-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          type="text"
          placeholder="Optional context for the storekeeper / approver…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div className="text-[12px] text-slate-700">
          Estimated value:{" "}
          <span className="font-semibold tabular-nums">
            ₹
            {totalValue.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={saveDraft}
            disabled={pending}
          >
            Save as draft
          </Button>
          <Button type="button" onClick={saveAndSubmit} disabled={pending}>
            {pending ? "Submitting…" : "Submit indent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
