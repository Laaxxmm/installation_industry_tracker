"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  InvoiceLineEditor,
  emptyInvoiceLine,
  type EditableInvoiceLine,
} from "../InvoiceLineEditor";
import { createClientInvoice } from "@/server/actions/client-invoices";

type ProjectOption = {
  id: string;
  code: string;
  name: string;
  client: {
    id: string;
    name: string;
    stateCode: string;
  } | null;
  purchaseOrder: { amount: string } | null;
  billedSoFar: string;
};

export function NewInvoiceForm({
  projects,
  supplierStateCode,
  preselectedProjectId,
}: {
  projects: ProjectOption[];
  supplierStateCode: string;
  preselectedProjectId?: string;
}) {
  const router = useRouter();
  const initialProject =
    (preselectedProjectId &&
      projects.find((p) => p.id === preselectedProjectId)) ||
    projects[0] ||
    null;
  const [projectId, setProjectId] = useState(initialProject?.id ?? "");
  const [kind, setKind] = useState<"ADVANCE" | "PROGRESS" | "FINAL" | "ADHOC">(
    "PROGRESS",
  );
  const [poSupplyStateCode, setPoSupplyStateCode] = useState(
    initialProject?.client?.stateCode ?? supplierStateCode,
  );
  const [dueAt, setDueAt] = useState("");
  const [poRef, setPoRef] = useState("");
  const [notes, setNotes] = useState("");
  const [termsMd, setTermsMd] = useState(
    "Payment terms: 30 days from invoice date. Interest @18% p.a. on overdue amounts.",
  );
  const [lines, setLines] = useState<EditableInvoiceLine[]>([emptyInvoiceLine()]);
  const [isPending, startTransition] = useTransition();

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;

  function onProjectChange(next: string) {
    setProjectId(next);
    const p = projects.find((pp) => pp.id === next);
    if (p?.client?.stateCode) setPoSupplyStateCode(p.client.stateCode);
  }

  function seedFromRemainder() {
    if (!selectedProject?.purchaseOrder) {
      toast.error("No Work Order for this project");
      return;
    }
    const remainder =
      Number(selectedProject.purchaseOrder.amount) -
      Number(selectedProject.billedSoFar);
    if (remainder <= 0) {
      toast.info("Nothing remaining to bill");
      return;
    }
    setLines([
      {
        key: Math.random().toString(36).slice(2),
        description: `Balance billing for ${selectedProject.code}`,
        hsnSac: "",
        quantity: "1",
        unit: "lot",
        // Grand total includes GST; we enter ex-tax price. Work backwards by
        // dividing by 1.18 assuming 18% GST as a sensible default; manager
        // can override.
        unitPrice: (remainder / 1.18).toFixed(2),
        discountPct: "0",
        gstRatePct: "18",
      },
    ]);
    toast.success("Seeded from unbilled remainder (assumes 18% GST)");
  }

  const submit = () => {
    if (!projectId) {
      toast.error("Pick a project");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createClientInvoice({
          projectId,
          kind,
          placeOfSupplyStateCode: poSupplyStateCode,
          dueAt: dueAt
            ? new Date(`${dueAt}T23:59:59.000Z`).toISOString()
            : null,
          poRef: poRef || undefined,
          notes: notes || undefined,
          termsMd: termsMd || undefined,
          lines: lines.map((l) => ({
            description: l.description,
            hsnSac: l.hsnSac || undefined,
            quantity: l.quantity || "0",
            unit: l.unit || "nos",
            unitPrice: l.unitPrice || "0",
            discountPct: l.discountPct || "0",
            gstRatePct: l.gstRatePct || "0",
          })),
        });
        toast.success("Draft invoice created");
        router.push(`/invoices/${result.invoiceId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Create failed");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1 block">Project</Label>
            <Select
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                  {p.client ? ` (${p.client.name})` : " (no client)"}
                </option>
              ))}
            </Select>
            {selectedProject?.client && (
              <p className="mt-1 text-[11px] text-slate-500">
                Bill to {selectedProject.client.name} · state{" "}
                {selectedProject.client.stateCode}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-1 block">Kind</Label>
            <Select
              value={kind}
              onChange={(e) =>
                setKind(
                  e.target.value as "ADVANCE" | "PROGRESS" | "FINAL" | "ADHOC",
                )
              }
            >
              <option value="ADVANCE">Advance</option>
              <option value="PROGRESS">Progress</option>
              <option value="FINAL">Final</option>
              <option value="ADHOC">Ad-hoc</option>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Place of supply (state code)</Label>
            <Input
              value={poSupplyStateCode}
              onChange={(e) => setPoSupplyStateCode(e.target.value)}
              maxLength={2}
              className="font-mono"
            />
          </div>
          <div>
            <Label className="mb-1 block">Due date (optional)</Label>
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1 block">PO reference (optional)</Label>
            <Input
              value={poRef}
              onChange={(e) => setPoRef(e.target.value)}
              placeholder="Client PO# or our Work Order#"
            />
          </div>
          {selectedProject?.purchaseOrder && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={seedFromRemainder}
              >
                Seed from unbilled remainder
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
        <h3 className="mb-3 text-[14px] font-semibold text-slate-900">Lines</h3>
        <InvoiceLineEditor
          lines={lines}
          onChange={setLines}
          supplierStateCode={supplierStateCode}
          placeOfSupplyStateCode={poSupplyStateCode}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1 block">Notes (optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note or instructions to the client"
            />
          </div>
          <div>
            <Label className="mb-1 block">Terms (optional)</Label>
            <Textarea
              rows={3}
              value={termsMd}
              onChange={(e) => setTermsMd(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button onClick={submit} disabled={isPending}>
          Save draft
        </Button>
      </div>
    </div>
  );
}
