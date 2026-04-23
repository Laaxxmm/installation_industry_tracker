"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice, inr } from "@/components/sab";

type Vendor = {
  id: string;
  code: string;
  name: string;
  paymentTerms: string;
};

type PO = {
  id: string;
  poNo: string;
  grandTotal: string;
};

type LineRow = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  gstRatePct: string;
};

type Props = {
  vendors: Vendor[];
  posByVendor: Record<string, PO[]>;
  initialVendorId?: string;
  initialPoId?: string;
  onSubmit: (raw: unknown) => Promise<unknown>;
};

const BLANK: LineRow = {
  description: "",
  unit: "nos",
  quantity: "1",
  unitPrice: "0",
  gstRatePct: "18",
};

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function VendorBillForm({
  vendors,
  posByVendor,
  initialVendorId,
  initialPoId,
  onSubmit,
}: Props) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string>(initialVendorId ?? vendors[0]?.id ?? "");
  const [poId, setPoId] = useState<string>(initialPoId ?? "");
  const [vendorBillNo, setVendorBillNo] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(today());
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<LineRow[]>([{ ...BLANK }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pos = posByVendor[vendorId] ?? [];

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const sub = num(l.quantity) * num(l.unitPrice);
      subtotal += sub;
      tax += (sub * num(l.gstRatePct)) / 100;
    }
    return { subtotal, tax, grand: subtotal + tax };
  }, [lines]);

  const linkedPo = pos.find((p) => p.id === poId);
  const diff = linkedPo ? totals.grand - num(linkedPo.grandTotal) : 0;
  const matchOk = linkedPo ? Math.abs(diff) <= 1 : null;

  function update(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function add() {
    setLines((prev) => [...prev, { ...BLANK }]);
  }

  function remove(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vendorId) {
      setError("Select a vendor first");
      return;
    }
    if (lines.some((l) => !l.description || !l.unit)) {
      setError("Every line needs description and unit");
      return;
    }
    const payload = {
      vendorId,
      poId: poId || null,
      vendorBillNo: vendorBillNo || undefined,
      issueDate: new Date(issueDate).toISOString(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || undefined,
      lines: lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        gstRatePct: l.gstRatePct,
      })),
    };
    startTransition(async () => {
      try {
        await onSubmit(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save bill");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border p-6"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
    >
      {error && (
        <div className="mb-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>Vendor</Label>
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setPoId("");
            }}
            required
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} · {v.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Link to PO (optional)</Label>
          <Select value={poId} onChange={(e) => setPoId(e.target.value)}>
            <option value="">— Direct bill —</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNo} · {inr(p.grandTotal)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Vendor bill no. (optional)</Label>
          <Input
            value={vendorBillNo}
            onChange={(e) => setVendorBillNo(e.target.value)}
            placeholder="e.g. INV/2026/0119"
          />
        </div>
        <div>
          <Label>Issue date</Label>
          <Input
            type="date"
            required
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="sab-caps" style={{ color: "var(--sab-ink3)" }}>
            Bill lines
          </div>
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
        </div>
        <div
          className="overflow-hidden rounded border"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <table className="w-full text-[12.5px] sab-tabular">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: "var(--sab-paper-alt)",
                  borderColor: "hsl(var(--border))",
                }}
              >
                {["Description", "Unit", "Qty", "Price", "GST%", "Total", ""].map((h, i) => (
                  <th
                    key={h || `c-${i}`}
                    className={`sab-caps px-2 py-2 ${
                      i >= 2 && i <= 5 ? "text-right" : "text-left"
                    }`}
                    style={{ color: "var(--sab-ink3)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const sub = num(l.quantity) * num(l.unitPrice);
                const total = sub + (sub * num(l.gstRatePct)) / 100;
                return (
                  <tr
                    key={i}
                    className="border-b"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <td className="px-2 py-1.5">
                      <Input
                        value={l.description}
                        onChange={(e) => update(i, { description: e.target.value })}
                        required
                      />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 72 }}>
                      <Input
                        value={l.unit}
                        onChange={(e) => update(i, { unit: e.target.value })}
                        required
                      />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 96 }}>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={l.quantity}
                        onChange={(e) => update(i, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 120 }}>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={l.unitPrice}
                        onChange={(e) => update(i, { unitPrice: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 80 }}>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={l.gstRatePct}
                        onChange={(e) => update(i, { gstRatePct: e.target.value })}
                      />
                    </td>
                    <td
                      className="px-2 py-1.5 text-right font-mono font-semibold"
                      style={{ color: "var(--sab-ink)" }}
                    >
                      {inr(total)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label="Remove line"
                        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[hsl(var(--secondary))]"
                        style={{ color: "var(--sab-ink3)" }}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--sab-paper-alt)" }}>
                <td colSpan={5} className="px-2 py-2 text-right sab-caps" style={{ color: "var(--sab-ink3)" }}>
                  Subtotal
                </td>
                <td
                  className="px-2 py-2 text-right font-mono"
                  style={{ color: "var(--sab-ink2)" }}
                >
                  {inr(totals.subtotal)}
                </td>
                <td />
              </tr>
              <tr style={{ background: "var(--sab-paper-alt)" }}>
                <td colSpan={5} className="px-2 py-2 text-right sab-caps" style={{ color: "var(--sab-ink3)" }}>
                  GST
                </td>
                <td
                  className="px-2 py-2 text-right font-mono"
                  style={{ color: "var(--sab-ink2)" }}
                >
                  {inr(totals.tax)}
                </td>
                <td />
              </tr>
              <tr style={{ background: "var(--sab-paper-alt)" }}>
                <td colSpan={5} className="px-2 py-2 text-right sab-caps" style={{ color: "var(--sab-ink)" }}>
                  Grand total
                </td>
                <td
                  className="px-2 py-2 text-right font-mono font-semibold"
                  style={{ color: "var(--sab-ink)" }}
                >
                  {inr(totals.grand)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {linkedPo && (
          <div
            className="mt-3 inline-flex items-center gap-2 rounded border px-3 py-1.5 text-[12px]"
            style={{
              background: matchOk
                ? "rgba(56,142,60,0.08)"
                : "rgba(193,50,48,0.08)",
              borderColor: "hsl(var(--border))",
              color: matchOk ? "var(--sab-positive)" : "var(--sab-alert)",
            }}
          >
            {matchOk
              ? `Matches PO ${linkedPo.poNo}`
              : `Off by ${inr(Math.abs(diff))} vs PO ${linkedPo.poNo}`}
          </div>
        )}
      </div>

      <div className="mt-5">
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record bill"}
        </Button>
      </div>
    </form>
  );
}
