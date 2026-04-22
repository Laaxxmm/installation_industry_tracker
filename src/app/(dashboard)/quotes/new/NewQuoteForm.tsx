"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQuote } from "@/server/actions/quotes";
import {
  emptyLine,
  QuoteLineEditor,
  type EditableLine,
} from "../QuoteLineEditor";

type Client = { id: string; name: string; stateCode: string; gstin: string | null };

export function NewQuoteForm({
  clients,
  supplierStateCode,
}: {
  clients: Client[];
  supplierStateCode: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState(
    clients[0]?.stateCode ?? supplierStateCode,
  );
  const [notes, setNotes] = useState("");
  const [termsMd, setTermsMd] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([emptyLine()]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  );

  function onClientChange(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) setPlaceOfSupplyStateCode(c.stateCode);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Pick a client");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one line");
      return;
    }
    startTransition(async () => {
      try {
        const q = await createQuote({
          clientId,
          title: title.trim(),
          validUntil: validUntil
            ? new Date(`${validUntil}T00:00:00Z`).toISOString()
            : null,
          placeOfSupplyStateCode,
          notes: notes.trim() || undefined,
          termsMd: termsMd.trim() || undefined,
          lines: lines.map((l) => ({
            category: l.category,
            description: l.description.trim(),
            hsnSac: l.hsnSac.trim() || undefined,
            quantity: l.quantity || "0",
            unit: l.unit || "nos",
            unitPrice: l.unitPrice || "0",
            discountPct: l.discountPct || "0",
            gstRatePct: l.gstRatePct || "0",
          })),
        });
        toast.success(`Quote ${q.quoteNo} created`);
        router.push(`/quotes/${q.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="clientId">Client</Label>
          <Select
            id="clientId"
            value={clientId}
            onChange={(e) => onClientChange(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.gstin ? ` · ${c.gstin}` : ""}
              </option>
            ))}
          </Select>
          {selectedClient && (
            <p className="text-[11px] text-slate-500">
              Default place of supply: state {selectedClient.stateCode}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            placeholder="E.g. Structured cabling + installation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="validUntil">Valid until</Label>
          <Input
            id="validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="placeOfSupply">Place of supply (state code)</Label>
          <Input
            id="placeOfSupply"
            required
            maxLength={2}
            value={placeOfSupplyStateCode}
            onChange={(e) => setPlaceOfSupplyStateCode(e.target.value)}
          />
          <p className="text-[11px] text-slate-500">
            Supplier state: {supplierStateCode}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Line items
        </div>
        <QuoteLineEditor
          lines={lines}
          onChange={setLines}
          supplierStateCode={supplierStateCode}
          placeOfSupplyStateCode={placeOfSupplyStateCode}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (client-visible)</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="terms">Terms &amp; conditions</Label>
          <Textarea
            id="terms"
            rows={3}
            value={termsMd}
            onChange={(e) => setTermsMd(e.target.value)}
            placeholder="Payment 50% advance, balance on delivery. Validity 30 days."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending} size="default">
          {pending ? "Creating…" : "Create quote"}
        </Button>
      </div>
    </form>
  );
}
