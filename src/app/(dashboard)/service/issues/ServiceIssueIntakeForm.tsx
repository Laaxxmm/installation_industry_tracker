"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/sab";

type Props = {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string | null }[];
  amcs: { id: string; contractNo: string; title: string; clientId: string }[];
  onSubmit: (raw: unknown) => Promise<unknown>;
};

export function ServiceIssueIntakeForm({ clients, projects, amcs, onSubmit }: Props) {
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [amcId, setAmcId] = useState("");
  const [channel, setChannel] = useState<"PHONE" | "WHATSAPP" | "EMAIL" | "PORTAL" | "WALK_IN">("PHONE");
  const [category, setCategory] = useState<
    | "LEAK"
    | "BURST"
    | "BLOCKAGE"
    | "PUMP_FAILURE"
    | "VALVE_FAILURE"
    | "SPRINKLER_HEAD"
    | "ELECTRICAL"
    | "GENERAL"
  >("GENERAL");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3" | "P4">("P3");
  const [reportedByName, setReportedByName] = useState("");
  const [reportedByPhone, setReportedByPhone] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleProjects = useMemo(
    () => projects.filter((p) => !clientId || !p.clientId || p.clientId === clientId),
    [projects, clientId],
  );
  const eligibleAMCs = useMemo(
    () => amcs.filter((a) => !clientId || a.clientId === clientId),
    [amcs, clientId],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) return setError("Pick a client");
    if (!projectId) return setError("Pick a project");
    startTransition(async () => {
      try {
        await onSubmit({
          clientId,
          projectId,
          amcId: amcId || undefined,
          reportedAt: new Date().toISOString(),
          reportedByName: reportedByName.trim(),
          reportedByPhone: reportedByPhone.trim() || undefined,
          channel,
          siteAddress: siteAddress.trim(),
          summary: summary.trim(),
          description: description.trim() || undefined,
          attachmentUrls: [],
          category,
          priority,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save ticket");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 max-w-3xl">
      {error && <Notice tone="alert">{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label>Linked AMC (optional)</Label>
          <Select value={amcId} onChange={(e) => setAmcId(e.target.value)}>
            <option value="">— None —</option>
            {eligibleAMCs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.contractNo} · {a.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Channel</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
            <option value="PHONE">Phone</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
            <option value="PORTAL">Portal</option>
            <option value="WALK_IN">Walk-in</option>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="LEAK">Leak</option>
            <option value="BURST">Burst</option>
            <option value="BLOCKAGE">Blockage</option>
            <option value="PUMP_FAILURE">Pump failure</option>
            <option value="VALVE_FAILURE">Valve failure</option>
            <option value="SPRINKLER_HEAD">Sprinkler head</option>
            <option value="ELECTRICAL">Electrical</option>
            <option value="GENERAL">General</option>
          </Select>
        </div>
        <div>
          <Label>Priority (preliminary)</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            <option value="P1">P1 — Critical</option>
            <option value="P2">P2 — High</option>
            <option value="P3">P3 — Normal</option>
            <option value="P4">P4 — Low</option>
          </Select>
        </div>
        <div>
          <Label>Reported by</Label>
          <Input
            value={reportedByName}
            onChange={(e) => setReportedByName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={reportedByPhone} onChange={(e) => setReportedByPhone(e.target.value)} />
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
        <div className="sm:col-span-2">
          <Label>Summary (5–200 chars)</Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={200}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Logging…" : "Log ticket"}
        </Button>
      </div>
    </form>
  );
}
