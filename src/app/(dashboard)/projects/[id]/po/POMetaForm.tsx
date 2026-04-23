"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePO } from "@/server/actions/purchase-orders";

export function POMetaForm({
  poId,
  initial,
}: {
  poId: string;
  initial: {
    clientPoNumber: string;
    clientPoDate: string;
    plannedStart: string;
    plannedEnd: string;
  };
}) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updatePO({
          poId,
          clientPoNumber: form.clientPoNumber.trim() || undefined,
          clientPoDate: form.clientPoDate
            ? new Date(`${form.clientPoDate}T00:00:00Z`).toISOString()
            : null,
          plannedStart: form.plannedStart
            ? new Date(`${form.plannedStart}T00:00:00Z`).toISOString()
            : undefined,
          plannedEnd: form.plannedEnd
            ? new Date(`${form.plannedEnd}T00:00:00Z`).toISOString()
            : undefined,
        });
        toast.success("Work Order updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="clientPoNumber">Client PO number</Label>
        <Input
          id="clientPoNumber"
          value={form.clientPoNumber}
          onChange={(e) =>
            setForm((f) => ({ ...f, clientPoNumber: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clientPoDate">Client PO date</Label>
        <Input
          id="clientPoDate"
          type="date"
          value={form.clientPoDate}
          onChange={(e) =>
            setForm((f) => ({ ...f, clientPoDate: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plannedStart">Planned start</Label>
        <Input
          id="plannedStart"
          type="date"
          value={form.plannedStart}
          onChange={(e) =>
            setForm((f) => ({ ...f, plannedStart: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plannedEnd">Planned end</Label>
        <Input
          id="plannedEnd"
          type="date"
          value={form.plannedEnd}
          onChange={(e) =>
            setForm((f) => ({ ...f, plannedEnd: e.target.value }))
          }
        />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
