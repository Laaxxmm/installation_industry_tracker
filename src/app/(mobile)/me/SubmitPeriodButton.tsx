"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitPeriod } from "@/server/actions/time";

export function SubmitPeriodButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await submitPeriod();
            toast.success("Submitted for approval");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Submit failed");
          }
        })
      }
    >
      Submit for approval
    </Button>
  );
}
