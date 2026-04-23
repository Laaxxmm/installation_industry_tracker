"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteStockReceipt } from "@/server/actions/inventory";

export function DeleteReceiptButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Delete this receipt? On-hand qty will be decreased.")) return;
    startTransition(async () => {
      try {
        await deleteStockReceipt(id);
        toast.success("Receipt deleted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="Delete receipt"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
