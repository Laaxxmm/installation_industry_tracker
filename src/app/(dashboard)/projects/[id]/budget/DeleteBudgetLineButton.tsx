"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteBudgetLine } from "@/server/actions/budgets";

export function DeleteBudgetLineButton({ lineId }: { lineId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (!confirm("Delete this budget line?")) return;
          try {
            await deleteBudgetLine(lineId);
            toast.success("Deleted");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
          }
        })
      }
    >
      Delete
    </Button>
  );
}
