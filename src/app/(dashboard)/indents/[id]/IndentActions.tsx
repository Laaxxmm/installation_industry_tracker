"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MaterialIndentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  approveIndent,
  cancelIndent,
  rejectIndent,
  submitIndent,
} from "@/server/actions/indents";

export function IndentActions({
  indentId,
  indentNo,
  status,
  canSubmit,
  canApprove,
  canCancel,
}: {
  indentId: string;
  indentNo: string;
  status: MaterialIndentStatus;
  canSubmit: boolean;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function doSubmit() {
    if (!confirm(`Submit ${indentNo} for review? Budget check runs now.`)) return;
    startTransition(async () => {
      try {
        await submitIndent(indentId);
        toast.success(`Submitted ${indentNo}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  function doApprove() {
    if (!confirm(`Approve ${indentNo}? Storekeeper can issue once approved.`))
      return;
    startTransition(async () => {
      try {
        await approveIndent(indentId);
        toast.success(`Approved ${indentNo}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to approve");
      }
    });
  }

  function doCancel() {
    if (
      !confirm(
        `Cancel ${indentNo}? This indent won't be issuable after cancellation.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await cancelIndent(indentId);
        toast.success(`Cancelled ${indentNo}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to cancel");
      }
    });
  }

  function doReject() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    startTransition(async () => {
      try {
        await rejectIndent(indentId, rejectReason.trim());
        toast.success(`Rejected ${indentNo}`);
        setShowRejectModal(false);
        setRejectReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to reject");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <Button size="sm" onClick={doSubmit} disabled={pending}>
            Submit for review
          </Button>
        )}
        {canApprove && (
          <>
            <Button size="sm" onClick={doApprove} disabled={pending}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRejectModal(true)}
              disabled={pending}
            >
              Reject
            </Button>
          </>
        )}
        {canCancel && status !== MaterialIndentStatus.CANCELLED && (
          <Button
            size="sm"
            variant="outline"
            onClick={doCancel}
            disabled={pending}
          >
            Cancel indent
          </Button>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-[14px] font-semibold">Reject {indentNo}</h3>
            <p className="mb-3 text-[12px] text-slate-600">
              The requester will see this reason. Be specific.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="e.g. Materials not budgeted; please raise a budget revision first."
              className="w-full rounded border border-slate-300 px-3 py-2 text-[13px]"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={doReject} disabled={pending}>
                {pending ? "Rejecting…" : "Confirm reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
