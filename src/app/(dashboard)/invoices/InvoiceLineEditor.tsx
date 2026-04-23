"use client";

import { useMemo } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { computeLine, summarise } from "@/lib/gst";
import { formatINR } from "@/lib/money";

export type EditableInvoiceLine = {
  key: string;
  description: string;
  hsnSac: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPct: string;
  gstRatePct: string;
};

export function emptyInvoiceLine(): EditableInvoiceLine {
  return {
    key: Math.random().toString(36).slice(2),
    description: "",
    hsnSac: "",
    quantity: "1",
    unit: "nos",
    unitPrice: "0",
    discountPct: "0",
    gstRatePct: "18",
  };
}

export function InvoiceLineEditor({
  lines,
  onChange,
  supplierStateCode,
  placeOfSupplyStateCode,
  readOnly = false,
}: {
  lines: EditableInvoiceLine[];
  onChange: (lines: EditableInvoiceLine[]) => void;
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  readOnly?: boolean;
}) {
  const computed = useMemo(
    () =>
      lines.map((l) => {
        try {
          return computeLine({
            quantity: l.quantity || "0",
            unitPrice: l.unitPrice || "0",
            discountPct: l.discountPct || "0",
            gstRatePct: l.gstRatePct || "0",
          });
        } catch {
          return null;
        }
      }),
    [lines],
  );

  const summary = useMemo(() => {
    try {
      return summarise({
        lines: lines.map((l) => ({
          quantity: l.quantity || "0",
          unitPrice: l.unitPrice || "0",
          discountPct: l.discountPct || "0",
          gstRatePct: l.gstRatePct || "0",
        })),
        supplierStateCode,
        placeOfSupplyStateCode,
      });
    } catch {
      return null;
    }
  }, [lines, supplierStateCode, placeOfSupplyStateCode]);

  function update(idx: number, patch: Partial<EditableInvoiceLine>) {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function remove(idx: number) {
    onChange(lines.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...lines, emptyInvoiceLine()]);
  }

  const intraState = supplierStateCode === placeOfSupplyStateCode;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">HSN/SAC</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              <th className="px-3 py-2 text-right">Disc %</th>
              <th className="px-3 py-2 text-right">GST %</th>
              <th className="px-3 py-2 text-right">Taxable</th>
              <th className="px-3 py-2 text-right">Tax</th>
              <th className="px-3 py-2 text-right">Total</th>
              {!readOnly && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const c = computed[i];
              return (
                <tr key={l.key} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1.5 min-w-[240px]">
                    <Input
                      value={l.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      className="h-8 text-[12px]"
                      placeholder="Description"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={l.hsnSac}
                      onChange={(e) => update(i, { hsnSac: e.target.value })}
                      className="h-8 w-24 text-[12px] font-mono"
                      placeholder="8544"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Input
                      type="number"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                      className="h-8 w-20 text-right text-[12px] tabular-nums"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={l.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="h-8 w-16 text-[12px]"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
                      className="h-8 w-24 text-right text-[12px] tabular-nums"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={l.discountPct}
                      onChange={(e) => update(i, { discountPct: e.target.value })}
                      className="h-8 w-16 text-right text-[12px] tabular-nums"
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Select
                      value={l.gstRatePct}
                      onChange={(e) => update(i, { gstRatePct: e.target.value })}
                      className="h-8 w-20 text-[12px]"
                      disabled={readOnly}
                    >
                      <option value="0">0</option>
                      <option value="5">5</option>
                      <option value="12">12</option>
                      <option value="18">18</option>
                      <option value="28">28</option>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {c ? formatINR(c.subtotal) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                    {c ? formatINR(c.tax) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                    {c ? formatINR(c.total) : "—"}
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 10 : 11}
                  className="px-3 py-6 text-center text-[12px] text-slate-500"
                >
                  No lines. Add one to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
        ) : (
          <span />
        )}

        {summary && lines.length > 0 && (
          <div className="grid w-[360px] gap-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px]">
            <Row label="Subtotal" value={formatINR(summary.subtotal)} />
            {intraState ? (
              <>
                <Row label="CGST" value={formatINR(summary.cgst)} />
                <Row label="SGST" value={formatINR(summary.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={formatINR(summary.igst)} />
            )}
            <Row label="Tax total" value={formatINR(summary.taxTotal)} />
            <div className="mt-1 border-t border-slate-200 pt-1">
              <Row
                label="Grand total"
                value={formatINR(summary.grandTotal)}
                bold
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              {intraState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"} ·
              Supplier state {supplierStateCode} · Place of supply{" "}
              {placeOfSupplyStateCode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-600"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold text-slate-900" : "text-slate-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
