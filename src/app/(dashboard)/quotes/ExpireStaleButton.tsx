"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { expireStaleQuotes } from "@/server/actions/quotes";

export function ExpireStaleButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      try {
        const r = await expireStaleQuotes();
        toast.success(`${r.expired} quote${r.expired === 1 ? "" : "s"} expired`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={pending}>
      Sweep expired
    </Button>
  );
}
