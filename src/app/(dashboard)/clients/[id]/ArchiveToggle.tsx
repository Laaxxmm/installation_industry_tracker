"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveClient, unarchiveClient } from "@/server/actions/clients";

export function ArchiveToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      try {
        if (active) {
          await archiveClient(id);
          toast.success("Client archived");
        } else {
          await unarchiveClient(id);
          toast.success("Client restored");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
      {active ? "Archive" : "Restore"}
    </Button>
  );
}
