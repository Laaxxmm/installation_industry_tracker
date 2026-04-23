"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Notice, Code } from "@/components/sab";

type POLine = {
  id: string;
  sku: string;
  description: string;
  unit: string;
  quantity: string;
  receivedQty: string;
};

type PO = {
  id: string;
  poNo: string;
  vendor: { name: string; code: string; msme: boolean };
  lines: POLine[];
};

type LineInput = {
  poLineId: string;
  acceptedQty: string;
  rejectedQty: string;
  reason: string;
};

type Props = {
  po: PO;
  onSubmit: (raw: unknown) => Promise<unknown>;
};

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function GRNForm({ po, onSubmit }: Props) {
  const router = useRouter();
  const [receivedAt, setReceivedAt] = useState<string>(() => {
    const d = new Date();
    const iso = d.toISOString().slice(0, 16);
    return iso;
  });
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<LineInput[]>(() =>
    po.lines.map((l) => {
      const remaining = Math.max(0, num(l.quantity) - num(l.receivedQty));
      return {
        poLineId: l.id,
        acceptedQty: String(remaining),
        rejectedQty: "0",
        reason: "",
      };
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(i: number, patch: Partial<LineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      poId: po.id,
      receivedAt: new Date(receivedAt).toISOString(),
      notes: notes || undefined,
      lines: lines
        .map((l) => ({
          poLineId: l.poLineId,
          acceptedQty: l.acceptedQty,
          rejectedQty: l.rejectedQty,
          reason: l.reason || undefined,
        }))
        .filter((l) => num(l.acceptedQty) > 0 || num(l.rejectedQty) > 0),
    };
    if (payload.lines.length === 0) {
      setError("Record at least one line with accepted or rejected quantity");
      return;
    }
    startTransition(async () => {
      try {
        await onSubmit(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save GRN");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border p-6"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
    >
      {error && (
        <div className="mb-4">
          <Notice tone="alert">{error}</Notice>
        </div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <div>
          <div className="sab-caps" style={{ color: "var(--sab-ink3)" }}>
            Against PO
          </div>
          <div className="mt-0.5 font-semibold" style={{ color: "var(--sab-ink)" }}>
            <Code>{po.poNo}</Code>
            <span className="ml-2 text-[12.5px]" style={{ color: "var(--sab-ink2)" }}>
              {po.vendor.name} · {po.vendor.code}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Received at</Label>
          <Input
            type="datetime-local"
            required
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-5">
        <div className="sab-caps mb-2" style={{ color: "var(--sab-ink3)" }}>
          Line receipts
        </div>
        <div
          className="overflow-hidden rounded border"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <table className="w-full text-[12.5px] sab-tabular">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: "var(--sab-paper-alt)",
                  borderColor: "hsl(var(--border))",
                }}
              >
                <th className="sab-caps px-2 py-2 text-left">SKU</th>
                <th className="sab-caps px-2 py-2 text-left">Description</th>
                <th className="sab-caps px-2 py-2 text-right">Ordered</th>
                <th className="sab-caps px-2 py-2 text-right">Already recd</th>
                <th className="sab-caps px-2 py-2 text-right">Accepted</th>
                <th className="sab-caps px-2 py-2 text-right">Rejected</th>
                <th className="sab-caps px-2 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((pl, i) => {
                const li = lines[i]!;
                const ordered = num(pl.quantity);
                const already = num(pl.receivedQty);
                const remaining = Math.max(0, ordered - already);
                const over =
                  num(li.acceptedQty) + num(li.rejectedQty) > remaining;
                return (
                  <tr
                    key={pl.id}
                    className="border-b"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <td className="px-2 py-1.5">
                      <Code>{pl.sku}</Code>
                    </td>
                    <td className="px-2 py-1.5" style={{ color: "var(--sab-ink2)" }}>
                      {pl.description}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {ordered} {pl.unit}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: "var(--sab-ink3)" }}>
                      {already}
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 96 }}>
                      <Input
                        className={`text-right ${over ? "border-[color:var(--sab-alert)]" : ""}`}
                        inputMode="decimal"
                        value={li.acceptedQty}
                        onChange={(e) => update(i, { acceptedQty: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 96 }}>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={li.rejectedQty}
                        onChange={(e) => update(i, { rejectedQty: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        placeholder="e.g. damaged, wrong size"
                        value={li.reason}
                        onChange={(e) => update(i, { reason: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-5">
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record GRN"}
        </Button>
      </div>
    </form>
  );
}
