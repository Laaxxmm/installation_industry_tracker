"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice, inr } from "@/components/sab";

// AMCForm — create or edit a contract. Visit-count is derived from frequency
// so operators can't hand-pick inconsistent combos (QUARTERLY must be 4/yr).

type Priority = "P1" | "P2" | "P3" | "P4";

type AssetLine = { name: string; qty?: number; notes?: string };
type SLARow = { priority: Priority; responseHours: number; resolutionHours: number };

type Props = {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string | null }[];
  onSubmit: (raw: unknown) => Promise<unknown>;
};

const FREQ_TO_VISITS: Record<string, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  HALF_YEARLY: 2,
  YEARLY: 1,
};

const DEFAULT_SLAS: SLARow[] = [
  { priority: "P1", responseHours: 1, resolutionHours: 4 },
  { priority: "P2", responseHours: 4, resolutionHours: 24 },
  { priority: "P3", responseHours: 8, resolutionHours: 72 },
  { priority: "P4", responseHours: 24, resolutionHours: 168 },
];

export function AMCForm({ clients, projects, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState<"COMPREHENSIVE" | "NON_COMPREHENSIVE" | "LABOUR_ONLY">("COMPREHENSIVE");
  const [billingMode, setBillingMode] = useState<"ANNUAL" | "INSTALLMENTS" | "PER_VISIT">("ANNUAL");
  const [frequency, setFrequency] = useState<"MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY">("QUARTERLY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [annualValue, setAnnualValue] = useState("0");
  const [taxPct, setTaxPct] = useState("18");
  const [siteAddress, setSiteAddress] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [notes, setNotes] = useState("");
  const [assets, setAssets] = useState<AssetLine[]>([{ name: "" }]);
  const [slas, setSlas] = useState<SLARow[]>(DEFAULT_SLAS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visitsPerYear = FREQ_TO_VISITS[frequency];
  const grandTotal = useMemo(() => {
    const v = Number(annualValue || 0);
    const t = Number(taxPct || 0);
    return v + (v * t) / 100;
  }, [annualValue, taxPct]);

  const eligibleProjects = projects.filter(
    (p) => !clientId || !p.clientId || p.clientId === clientId,
  );

  function updateAsset(i: number, patch: Partial<AssetLine>) {
    setAssets((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateSLA(i: number, patch: Partial<SLARow>) {
    setSlas((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanedAssets = assets.filter((a) => a.name.trim().length > 0);
    if (cleanedAssets.length === 0) {
      setError("Add at least one covered asset");
      return;
    }
    if (!clientId) {
      setError("Pick a client");
      return;
    }
    if (!projectId) {
      setError("Pick a project");
      return;
    }
    const payload = {
      title: title.trim(),
      clientId,
      projectId,
      type,
      billingMode,
      frequency,
      visitsPerYear,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      annualValue,
      taxPct,
      siteAddress: siteAddress.trim(),
      assetsCovered: cleanedAssets,
      exclusions: exclusions.trim() || undefined,
      notes: notes.trim() || undefined,
      slas,
    };
    startTransition(async () => {
      try {
        await onSubmit(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save AMC");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 max-w-4xl">
      {error && <Notice tone="alert">{error}</Notice>}

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label>Contract type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="COMPREHENSIVE">Comprehensive</option>
            <option value="NON_COMPREHENSIVE">Non-comprehensive</option>
            <option value="LABOUR_ONLY">Labour only</option>
          </Select>
        </div>
        <div>
          <Label>Client</Label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Project / site</Label>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">— Select project —</option>
            {eligibleProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Billing mode</Label>
          <Select
            value={billingMode}
            onChange={(e) => setBillingMode(e.target.value as typeof billingMode)}
          >
            <option value="ANNUAL">Annual (one invoice)</option>
            <option value="INSTALLMENTS">Installments (per visit)</option>
            <option value="PER_VISIT">Per-visit (ad-hoc billing)</option>
          </Select>
        </div>
        <div>
          <Label>Visit frequency</Label>
          <Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
          >
            <option value="MONTHLY">Monthly (12/yr)</option>
            <option value="QUARTERLY">Quarterly (4/yr)</option>
            <option value="HALF_YEARLY">Half-yearly (2/yr)</option>
            <option value="YEARLY">Yearly (1/yr)</option>
          </Select>
        </div>
        <div>
          <Label>Start date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>End date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Annual value (₹)</Label>
          <Input
            type="number"
            step="0.01"
            value={annualValue}
            onChange={(e) => setAnnualValue(e.target.value)}
          />
        </div>
        <div>
          <Label>Tax %</Label>
          <Input
            type="number"
            step="0.01"
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Site address</Label>
          <Textarea
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
            rows={2}
            required
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Covered assets</h3>
        <div className="grid gap-2">
          {assets.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto] items-end">
              <div>
                <Label>Asset</Label>
                <Input
                  value={a.name}
                  onChange={(e) => updateAsset(i, { name: e.target.value })}
                  placeholder="e.g. Jockey pump 2 HP"
                />
              </div>
              <div>
                <Label>Qty</Label>
                <Input
                  type="number"
                  value={a.qty ?? ""}
                  onChange={(e) => updateAsset(i, { qty: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={a.notes ?? ""}
                  onChange={(e) => updateAsset(i, { notes: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAssets((rows) => rows.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setAssets((rows) => [...rows, { name: "" }])}
        >
          + Add asset
        </Button>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Service level agreements</h3>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              <th className="text-left py-1.5">Priority</th>
              <th className="text-left py-1.5">Response (hrs)</th>
              <th className="text-left py-1.5">Resolution (hrs)</th>
            </tr>
          </thead>
          <tbody>
            {slas.map((s, i) => (
              <tr key={s.priority} className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                <td className="py-1.5 font-mono">{s.priority}</td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    min={1}
                    value={s.responseHours}
                    onChange={(e) => updateSLA(i, { responseHours: Number(e.target.value) })}
                    className="w-24"
                  />
                </td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    min={1}
                    value={s.resolutionHours}
                    onChange={(e) => updateSLA(i, { resolutionHours: Number(e.target.value) })}
                    className="w-24"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Exclusions</Label>
            <Textarea
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
      </section>

      <div
        className="rounded border p-4 text-sm grid gap-1"
        style={{ borderColor: "hsl(var(--border))", background: "var(--sab-paper-alt)" }}
      >
        <div>
          <span style={{ color: "var(--sab-ink3)" }}>Grand total (base + tax): </span>
          <span className="font-mono font-semibold">{inr(grandTotal)}</span>
        </div>
        <div style={{ color: "var(--sab-ink3)" }}>
          {visitsPerYear} scheduled visit{visitsPerYear === 1 ? "" : "s"} per year.
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create AMC (draft)"}
        </Button>
      </div>
    </form>
  );
}
