"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/server/actions/clients";

type Initial = {
  id?: string;
  name?: string;
  gstin?: string | null;
  pan?: string | null;
  billingAddress?: string;
  shippingAddress?: string | null;
  stateCode?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export function ClientForm({ initial, mode }: { initial?: Initial; mode: "create" | "edit" }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    gstin: initial?.gstin ?? "",
    pan: initial?.pan ?? "",
    billingAddress: initial?.billingAddress ?? "",
    shippingAddress: initial?.shippingAddress ?? "",
    stateCode: initial?.stateCode ?? "",
    contactName: initial?.contactName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    notes: initial?.notes ?? "",
  });
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          gstin: form.gstin.trim().toUpperCase() || undefined,
          pan: form.pan.trim().toUpperCase() || undefined,
          billingAddress: form.billingAddress.trim(),
          shippingAddress: form.shippingAddress.trim() || undefined,
          stateCode: form.stateCode.trim(),
          contactName: form.contactName.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        };
        if (mode === "create") {
          const c = await createClient(payload);
          toast.success(`Client "${c.name}" created`);
          router.push(`/clients/${c.id}`);
        } else if (initial?.id) {
          await updateClient(initial.id, payload);
          toast.success("Client updated");
          router.refresh();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Client name</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            placeholder="29AAACK0000A1Z5"
            maxLength={15}
            value={form.gstin}
            onChange={(e) =>
              setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))
            }
          />
          <p className="text-[11px] text-slate-500">
            15 chars: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter + 1 digit
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            placeholder="AAACK0000A"
            maxLength={10}
            value={form.pan}
            onChange={(e) =>
              setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="billingAddress">Billing address</Label>
          <Textarea
            id="billingAddress"
            required
            rows={3}
            value={form.billingAddress}
            onChange={(e) =>
              setForm((f) => ({ ...f, billingAddress: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stateCode">Place-of-supply state code</Label>
          <Input
            id="stateCode"
            required
            placeholder="29"
            maxLength={2}
            value={form.stateCode}
            onChange={(e) => setForm((f) => ({ ...f, stateCode: e.target.value }))}
          />
          <p className="text-[11px] text-slate-500">2-digit GST code (e.g. 29 Karnataka)</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shippingAddress">Shipping address (if different)</Label>
        <Textarea
          id="shippingAddress"
          rows={2}
          value={form.shippingAddress}
          onChange={(e) =>
            setForm((f) => ({ ...f, shippingAddress: e.target.value }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact name</Label>
          <Input
            id="contactName"
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending} size="default">
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create client"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
