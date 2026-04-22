"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateInvoiceHeader } from "@/server/actions/client-invoices";

type InitialHeader = {
  invoiceId: string;
  kind: "ADVANCE" | "PROGRESS" | "FINAL" | "ADHOC";
  placeOfSupplyStateCode: string;
  dueAt: string | null;
  poRef: string | null;
  notes: string | null;
  termsMd: string | null;
};

export function EditInvoiceHeaderButton({
  header,
}: {
  header: InitialHeader;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = useMemo(
    () => ({
      kind: header.kind,
      placeOfSupplyStateCode: header.placeOfSupplyStateCode,
      dueAt: header.dueAt ? header.dueAt.slice(0, 10) : "",
      poRef: header.poRef ?? "",
      notes: header.notes ?? "",
      termsMd: header.termsMd ?? "",
    }),
    [header],
  );

  const [form, setForm] = useState(initial);

  function onOpenChange(v: boolean) {
    if (v) setForm(initial);
    setOpen(v);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateInvoiceHeader({
          invoiceId: header.invoiceId,
          kind: form.kind,
          placeOfSupplyStateCode: form.placeOfSupplyStateCode,
          dueAt: form.dueAt
            ? new Date(`${form.dueAt}T00:00:00Z`).toISOString()
            : null,
          poRef: form.poRef || null,
          notes: form.notes || null,
          termsMd: form.termsMd || null,
        });
        toast.success("Invoice updated");
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
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-brand"
        title="Edit invoice header"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title="Edit invoice header"
        description="Only editable while DRAFT. Changing place-of-supply recomputes tax."
      >
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as InitialHeader["kind"],
                  }))
                }
              >
                <option value="ADVANCE">Advance</option>
                <option value="PROGRESS">Progress</option>
                <option value="FINAL">Final</option>
                <option value="ADHOC">Ad-hoc</option>
              </Select>
            </div>
            <div>
              <Label>POS state</Label>
              <Input
                maxLength={2}
                required
                value={form.placeOfSupplyStateCode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    placeOfSupplyStateCode: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueAt: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>PO ref</Label>
              <Input
                value={form.poRef}
                onChange={(e) =>
                  setForm((f) => ({ ...f, poRef: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Terms</Label>
            <Textarea
              rows={3}
              value={form.termsMd}
              onChange={(e) =>
                setForm((f) => ({ ...f, termsMd: e.target.value }))
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
