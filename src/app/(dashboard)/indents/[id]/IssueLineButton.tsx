"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issueIndentLine } from "@/server/actions/indents";

export function IssueLineButton({
  lineId,
  maxQty,
  onHandQty,
  materialName,
  unit,
}: {
  lineId: string;
  maxQty: string;     // remaining = requested − already-issued
  onHandQty: string;  // current Material.onHandQty
  materialName: string;
  unit: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Default: issue full remaining if stock allows, else issue what's on hand.
  const remaining = Number(maxQty);
  const onHand = Number(onHandQty);
  const safeDefault =
    Number.isFinite(remaining) && Number.isFinite(onHand)
      ? Math.min(remaining, Math.max(0, onHand))
      : remaining;
  const [qty, setQty] = useState(String(safeDefault));
  const [note, setNote] = useState("");

  function doIssue() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Quantity must be positive.");
      return;
    }
    if (n > Number(maxQty)) {
      toast.error(`Max issuable on this line: ${maxQty}`);
      return;
    }
    if (n > Number(onHandQty)) {
      toast.error(`Only ${onHandQty} ${unit} on hand`);
      return;
    }
    startTransition(async () => {
      try {
        await issueIndentLine(lineId, {
          qtyToIssue: qty,
          note: note || null,
        });
        toast.success(
          `Issued ${qty} ${unit} of ${materialName}`,
        );
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to issue");
      }
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Issue
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        type="number"
        inputMode="decimal"
        step="0.001"
        min="0"
        max={maxQty}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-24 text-right"
        autoFocus
      />
      <Input
        type="text"
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-32"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={doIssue} disabled={pending}>
          {pending ? "…" : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
