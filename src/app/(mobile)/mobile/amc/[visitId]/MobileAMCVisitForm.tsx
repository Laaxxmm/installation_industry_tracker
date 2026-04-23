"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/sab";

type PartLine = { sku: string; description: string; qty: string; unit: string };
type CheckItem = { item: string; ok: boolean; note?: string };

type Props = {
  visitId: string;
  defaultChecklist?: CheckItem[];
  billingMode: string;
  onStart: (id: string) => Promise<unknown>;
  onComplete: (id: string, raw: unknown) => Promise<unknown>;
};

const DEFAULT_CHECKLIST: CheckItem[] = [
  { item: "Pump pressure verified", ok: false },
  { item: "Valves operational", ok: false },
  { item: "No visible leaks", ok: false },
  { item: "Strainers cleaned", ok: false },
];

// Random unique-ish ID for offline-safe idempotency. crypto.randomUUID is
// not universally available on older mobile browsers — guard it.
function newOpId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function MobileAMCVisitForm({ visitId, defaultChecklist, billingMode, onStart, onComplete }: Props) {
  const router = useRouter();
  const [findings, setFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [billableAmount, setBillableAmount] = useState("");
  const [checklist, setChecklist] = useState<CheckItem[]>(
    defaultChecklist && defaultChecklist.length > 0 ? defaultChecklist : DEFAULT_CHECKLIST,
  );
  const [parts, setParts] = useState<PartLine[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [opId] = useState(() => newOpId());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function captureGeo() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message),
      { maximumAge: 60_000, timeout: 10_000, enableHighAccuracy: true },
    );
  }

  function toggleCheck(i: number) {
    setChecklist((cl) => cl.map((c, idx) => (idx === i ? { ...c, ok: !c.ok } : c)));
  }
  function addPart() {
    setParts((ps) => [...ps, { sku: "", description: "", qty: "1", unit: "nos" }]);
  }
  function updatePart(i: number, patch: Partial<PartLine>) {
    setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    // Stub: the real upload goes through the existing upload helper. For v1
    // this accepts pre-signed URLs pasted in (same as desktop).
    const urls = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    setPhotoUrls(urls);
  }

  function start() {
    setError(null);
    startTransition(async () => {
      try {
        await onStart(visitId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start visit");
      }
    });
  }

  function complete() {
    setError(null);
    const cleanedParts = parts.filter((p) => p.description.trim().length > 0);
    startTransition(async () => {
      try {
        await onComplete(visitId, {
          findings: findings.trim() || undefined,
          notes: notes.trim() || undefined,
          partsUsed: cleanedParts.length > 0 ? cleanedParts : undefined,
          photoUrls,
          geoLat: geo?.lat,
          geoLng: geo?.lng,
          checklist,
          billableAmount: billingMode === "PER_VISIT" && billableAmount ? billableAmount : undefined,
          offlineClientOpId: opId,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete visit");
      }
    });
  }

  return (
    <div className="grid gap-3">
      {error && <Notice tone="alert">{error}</Notice>}

      <div>
        <Button disabled={pending} onClick={start} className="w-full">
          Start visit
        </Button>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-2">Checklist</h3>
        <ul className="grid gap-1">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={c.ok} onChange={() => toggleCheck(i)} />
              <span>{c.item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Label>Findings</Label>
        <Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </section>

      <section>
        <Label>Parts used</Label>
        <div className="grid gap-2">
          {parts.map((p, i) => (
            <div key={i} className="grid gap-1 grid-cols-[1fr_80px_60px]">
              <Input
                placeholder="Description"
                value={p.description}
                onChange={(e) => updatePart(i, { description: e.target.value })}
              />
              <Input
                placeholder="SKU"
                value={p.sku}
                onChange={(e) => updatePart(i, { sku: e.target.value })}
              />
              <Input
                placeholder="Qty"
                value={p.qty}
                onChange={(e) => updatePart(i, { qty: e.target.value })}
              />
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" className="mt-1" onClick={addPart}>
          + Part
        </Button>
      </section>

      <section>
        <Label>Photos (comma-separated URLs)</Label>
        <Input placeholder="https://… , https://…" onChange={onUpload} />
      </section>

      <section className="grid gap-2">
        <Button variant="outline" onClick={captureGeo} className="w-full">
          {geo ? `Geo captured: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` : "Capture location"}
        </Button>
      </section>

      {billingMode === "PER_VISIT" && (
        <section>
          <Label>Billable amount (₹)</Label>
          <Input
            type="number"
            step="0.01"
            value={billableAmount}
            onChange={(e) => setBillableAmount(e.target.value)}
          />
        </section>
      )}

      <section>
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      <div>
        <Button disabled={pending} onClick={complete} className="w-full">
          {pending ? "Saving…" : "Mark complete"}
        </Button>
      </div>
    </div>
  );
}
