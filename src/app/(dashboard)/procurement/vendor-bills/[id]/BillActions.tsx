"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { VendorBillStatus } from "@prisma/client";

type Props = {
  status: VendorBillStatus;
  hasPO: boolean;
  onMatch: () => Promise<void>;
  onApprove: () => Promise<void>;
  onPay: () => Promise<void>;
};

export function BillActions({ status, hasPO, onMatch, onApprove, onPay }: Props) {
  const [pending, startTransition] = useTransition();

  const canMatch = hasPO && (status === "PENDING_MATCH" || status === "DISCREPANCY");
  const canApprove = status === "MATCHED" || status === "DRAFT";
  const canPay = status === "APPROVED" || status === "OVERDUE";

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
      {canMatch && (
        <Button size="sm" variant="outline" onClick={() => run(onMatch)} disabled={pending}>
          {pending ? "Working…" : "Run 3-way match"}
        </Button>
      )}
      {canApprove && (
        <Button size="sm" onClick={() => run(onApprove)} disabled={pending}>
          {pending ? "Working…" : "Approve"}
        </Button>
      )}
      {canPay && (
        <Button size="sm" onClick={() => run(onPay)} disabled={pending}>
          {pending ? "Working…" : "Mark paid"}
        </Button>
      )}
    </div>
  );
}
