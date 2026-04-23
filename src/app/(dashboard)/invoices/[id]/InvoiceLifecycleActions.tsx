"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  cancelInvoice,
  deleteDraftInvoice,
  issueInvoice,
  markInvoicePaid,
} from "@/server/actions/client-invoices";

type Status = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

export function InvoiceLifecycleActions({
  invoiceId,
  status,
  grandTotal,
  amountPaid,
}: {
  invoiceId: string;
  status: Status;
  grandTotal: string;
  amountPaid: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payAmount, setPayAmount] = useState(
    (Number(grandTotal) - Number(amountPaid)).toFixed(2),
  );
  const [payDate, setPayDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [cancelReason, setCancelReason] = useState("");

  const issue = () => {
    if (!confirm("Issue this invoice? A permanent invoice number will be assigned and lines will be frozen.")) return;
    startTransition(async () => {
      try {
        const result = await issueInvoice(invoiceId);
        toast.success(`Issued as ${result.invoiceNo}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Issue failed");
      }
    });
  };

  const removeDraft = () => {
    if (!confirm("Delete this draft invoice? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteDraftInvoice(invoiceId);
        toast.success("Draft deleted");
        router.push("/invoices");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const pay = () => {
    startTransition(async () => {
      try {
        await markInvoicePaid({
          invoiceId,
          amountPaid: payAmount,
          paidAt: new Date(`${payDate}T12:00:00.000Z`).toISOString(),
        });
        toast.success("Payment recorded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  const cancel = () => {
    if (!cancelReason.trim()) {
      toast.error("Reason required");
      return;
    }
    if (!confirm(`Cancel invoice? ${cancelReason}`)) return;
    startTransition(async () => {
      try {
        await cancelInvoice({ invoiceId, reason: cancelReason.trim() });
        toast.success("Invoice cancelled");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Cancel failed");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle</CardTitle>
        <CardDescription>
          {status === "DRAFT" && "Issue to freeze and assign sequence number."}
          {status === "ISSUED" && "Record payments or cancel."}
          {status === "PAID" && "Fully paid. Cancel to reverse if needed."}
          {status === "CANCELLED" && "Cancelled — read-only record."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-[13px]">
        {status === "DRAFT" && (
          <>
            <Button onClick={issue} disabled={isPending} className="w-full">
              Issue invoice
            </Button>
            <Button
              variant="outline"
              onClick={removeDraft}
              disabled={isPending}
              className="w-full"
            >
              Delete draft
            </Button>
          </>
        )}
        {(status === "ISSUED" || status === "PAID") && (
          <>
            <div className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Record payment
              </div>
              <div className="grid gap-2">
                <div>
                  <Label className="mb-1 block text-[11px]">
                    Amount paid (cumulative)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-[11px]">Paid on</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="h-8 text-[12px]"
                  />
                </div>
                <Button size="sm" onClick={pay} disabled={isPending}>
                  Save payment
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-red-200 bg-red-50/30 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-red-700">
                Cancel invoice
              </div>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (stamped in notes)"
                className="mb-2 h-8 text-[12px]"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={cancel}
                disabled={isPending || !cancelReason.trim()}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
