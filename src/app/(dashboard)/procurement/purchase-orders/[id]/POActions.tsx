"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { VendorPOStatus } from "@prisma/client";

type Props = {
  status: VendorPOStatus;
  onApprove: () => Promise<void>;
  onSend: () => Promise<void>;
  onCancel: () => Promise<void>;
};

export function POActions({ status, onApprove, onSend, onCancel }: Props) {
  const [pending, startTransition] = useTransition();

  const canApprove = status === "PENDING_APPROVAL";
  const canSend = status === "APPROVED";
  const canCancel = ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(status);

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {canApprove && (
        <Button size="sm" onClick={() => run(onApprove)} disabled={pending}>
          {pending ? "Working…" : "Approve"}
        </Button>
      )}
      {canSend && (
        <Button size="sm" onClick={() => run(onSend)} disabled={pending}>
          {pending ? "Working…" : "Send to vendor"}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (confirm("Cancel this PO? This cannot be undone.")) run(onCancel);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
