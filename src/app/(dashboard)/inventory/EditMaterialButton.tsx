"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMaterial } from "@/server/actions/inventory";

export function EditMaterialButton({
  id,
  sku,
  name,
  unit,
}: {
  id: string;
  sku: string;
  name: string;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ sku, name, unit });

  function onOpenChange(v: boolean) {
    if (v) setForm({ sku, name, unit });
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMaterial(id, form);
        toast.success("Material updated");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand"
        title="Edit material"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit material"
        description="Updates SKU, name, and unit. Does not affect on-hand qty or cost."
      >
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor={`sku-${id}`}>SKU</Label>
            <Input
              id={`sku-${id}`}
              required
              value={form.sku}
              onChange={(e) =>
                setForm((f) => ({ ...f, sku: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor={`name-${id}`}>Name</Label>
            <Input
              id={`name-${id}`}
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor={`unit-${id}`}>Unit</Label>
            <Input
              id={`unit-${id}`}
              required
              value={form.unit}
              onChange={(e) =>
                setForm((f) => ({ ...f, unit: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
