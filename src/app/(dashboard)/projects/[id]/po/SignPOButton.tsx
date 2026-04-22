"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signPO } from "@/server/actions/purchase-orders";

export function SignPOButton({ poId }: { poId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function sign() {
    startTransition(async () => {
      try {
        await signPO(poId);
        toast.success("Marked signed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Button size="sm" variant="success" onClick={sign} disabled={pending}>
      Mark signed
    </Button>
  );
}
