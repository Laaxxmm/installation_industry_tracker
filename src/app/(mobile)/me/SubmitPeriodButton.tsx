"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { submitPeriod } from "@/server/actions/time";

export function SubmitPeriodButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await submitPeriod();
            toast.success("Submitted for approval");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Submit failed");
          }
        })
      }
      className="flex-none rounded-[8px] bg-sab-accent px-3 py-2 font-sab-sans text-[12px] font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit"}
    </button>
  );
}
