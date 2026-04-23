"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveEntries,
  deleteTimeEntry,
  rejectEntries,
  unapproveEntry,
} from "@/server/actions/time";

export function ApprovalActions({
  entryId,
  status = "SUBMITTED",
  canDelete = false,
}: {
  entryId: string;
  status?: string;
  canDelete?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";
  const isSubmitted = status === "SUBMITTED";

  return (
    <div className="flex items-center justify-end gap-2">
      {canDelete && !isApproved && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={() => {
            if (
              !window.confirm(
                "Delete this timesheet entry? Photos and the record are removed permanently.",
              )
            )
              return;
            startTransition(async () => {
              try {
                await deleteTimeEntry(entryId);
                toast.success("Entry deleted");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Delete failed");
              }
            });
          }}
          aria-label="Delete entry"
          title="Delete entry"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      )}
      {canDelete && (isApproved || isRejected) && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                isApproved
                  ? "Unapprove this entry? It will return to SUBMITTED and be removed from labor cost."
                  : "Move this rejected entry back to SUBMITTED for re-review?",
              )
            )
              return;
            startTransition(async () => {
              try {
                await unapproveEntry(entryId);
                toast.success("Moved back to SUBMITTED");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Unapprove failed");
              }
            });
          }}
          aria-label="Move back to submitted"
          title="Move back to submitted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Unapprove
        </Button>
      )}
      {isSubmitted && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await rejectEntries([entryId]);
                  toast.success("Rejected");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Reject failed");
                }
              })
            }
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await approveEntries([entryId]);
                  toast.success("Approved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Approve failed");
                }
              })
            }
          >
            Approve
          </Button>
        </>
      )}
    </div>
  );
}
