"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInvoice } from "@/server/actions/overhead";

type ProjectOpt = { id: string; code: string; name: string };

export function InvoiceForm({ projects }: { projects: ProjectOpt[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    invoiceNo: "",
    amount: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId) {
      toast.error("Pick a project");
      return;
    }
    startTransition(async () => {
      try {
        await createInvoice({
          projectId: form.projectId,
          invoiceNo: form.invoiceNo,
          amount: form.amount,
          issuedAt: new Date(`${form.issuedAt}T00:00:00Z`).toISOString(),
          note: form.note || undefined,
        });
        toast.success("Invoice booked");
        setForm((f) => ({ ...f, invoiceNo: "", amount: "", note: "" }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-4 md:items-end">
      <div className="md:col-span-2">
        <Label htmlFor="inv-projectId">Project</Label>
        <Select
          id="inv-projectId"
          value={form.projectId}
          onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="invoiceNo">Invoice #</Label>
        <Input
          id="invoiceNo"
          required
          value={form.invoiceNo}
          onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="inv-amount">Amount (₹)</Label>
        <Input
          id="inv-amount"
          type="number"
          step="0.01"
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="issuedAt">Issued</Label>
        <Input
          id="issuedAt"
          type="date"
          required
          value={form.issuedAt}
          onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))}
        />
      </div>
      <div className="md:col-span-3">
        <Label htmlFor="inv-note">Note</Label>
        <Textarea
          id="inv-note"
          rows={2}
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </div>
      <div className="md:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Book invoice"}
        </Button>
      </div>
    </form>
  );
}
