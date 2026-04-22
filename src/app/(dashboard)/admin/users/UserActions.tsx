"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserActive } from "@/server/actions/users";

export function UserActions({ userId, active }: { userId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await setUserActive(userId, !active);
            toast.success(active ? "User disabled" : "User activated");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action failed");
          }
        })
      }
    >
      {active ? "Disable" : "Activate"}
    </Button>
  );
}
