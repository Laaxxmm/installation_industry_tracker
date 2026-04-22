"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuoteLineEditor, type EditableLine } from "../QuoteLineEditor";
import { replaceQuoteLines } from "@/server/actions/quotes";
import { formatINR } from "@/lib/money";

export function QuoteLinesEditor({
  quoteId,
  canEdit,
  initialLines,
  supplierStateCode,
  placeOfSupplyStateCode,
}: {
  quoteId: string;
  canEdit: boolean;
  initialLines: EditableLine[];
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
}) {
  const [lines, setLines] = useState<EditableLine[]>(initialLines);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canEdit) {
    return (
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">HSN/SAC</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              <th className="px-3 py-2 text-right">Disc %</th>
              <th className="px-3 py-2 text-right">GST %</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr
                key={l.key}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="px-3 py-2 text-[11px] text-slate-600">
                  {l.category}
                </td>
                <td className="px-3 py-2 text-slate-900">{l.description}</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {l.hsnSac || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="px-3 py-2 text-[11px]">{l.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatINR(l.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.discountPct}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.gstRatePct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function save() {
    startTransition(async () => {
      try {
        await replaceQuoteLines(quoteId, {
          lines: lines.map((l) => ({
            category: l.category,
            description: l.description.trim(),
            hsnSac: l.hsnSac.trim() || undefined,
            quantity: l.quantity || "0",
            unit: l.unit || "nos",
            unitPrice: l.unitPrice || "0",
            discountPct: l.discountPct || "0",
            gstRatePct: l.gstRatePct || "0",
          })),
        });
        toast.success("Lines saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <QuoteLineEditor
        lines={lines}
        onChange={setLines}
        supplierStateCode={supplierStateCode}
        placeOfSupplyStateCode={placeOfSupplyStateCode}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending} size="sm">
          {pending ? "Saving…" : "Save lines"}
        </Button>
      </div>
    </div>
  );
}
