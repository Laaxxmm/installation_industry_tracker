"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InvoiceLineEditor,
  type EditableInvoiceLine,
} from "../InvoiceLineEditor";
import { replaceInvoiceLines } from "@/server/actions/client-invoices";

export function InvoiceLinesEditor({
  invoiceId,
  initialLines,
  placeOfSupplyStateCode,
  supplierStateCode,
  readOnly,
}: {
  invoiceId: string;
  initialLines: EditableInvoiceLine[];
  placeOfSupplyStateCode: string;
  supplierStateCode: string;
  readOnly: boolean;
}) {
  const [lines, setLines] = useState<EditableInvoiceLine[]>(initialLines);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      try {
        await replaceInvoiceLines({
          invoiceId,
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
        toast.success("Lines saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <div className="space-y-3">
      <InvoiceLineEditor
        lines={lines}
        onChange={setLines}
        supplierStateCode={supplierStateCode}
        placeOfSupplyStateCode={placeOfSupplyStateCode}
        readOnly={readOnly}
      />
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending} size="sm">
            Save lines
          </Button>
        </div>
      )}
    </div>
  );
}
