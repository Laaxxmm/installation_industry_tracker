"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Notice } from "@/components/sab";

type Priority = "P1" | "P2" | "P3" | "P4";
type Category =
  | "LEAK"
  | "BURST"
  | "BLOCKAGE"
  | "PUMP_FAILURE"
  | "VALVE_FAILURE"
  | "SPRINKLER_HEAD"
  | "ELECTRICAL"
  | "GENERAL";
type Coverage = "AMC" | "WARRANTY" | "GOODWILL" | "BILLABLE";

type Props = {
  issueId: string;
  status: string;
  priority: Priority;
  category: Category;
  coverage: Coverage;
  suggestedCoverage: Coverage;
  assignees: { id: string; name: string }[];
  onTriage: (id: string, raw: unknown) => Promise<unknown>;
  onAssign: (id: string, userId: string) => Promise<unknown>;
  onStart: (id: string) => Promise<unknown>;
  onHold: (id: string, reason: string) => Promise<unknown>;
  onResume: (id: string) => Promise<unknown>;
  onResolve: (id: string) => Promise<unknown>;
  onVerify: (id: string, name: string) => Promise<unknown>;
  onClose: (id: string, raw: unknown) => Promise<unknown>;
  onBill: (id: string) => Promise<unknown>;
};

export function ServiceIssueActions(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"triage" | "hold" | "verify" | "close" | null>(null);

  // Triage panel state.
  const [triagePriority, setTriagePriority] = useState<Priority>(p.priority);
  const [triageCategory, setTriageCategory] = useState<Category>(p.category);
  const [triageCoverage, setTriageCoverage] = useState<Coverage>(p.suggestedCoverage);
  const [overrideReason, setOverrideReason] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const [holdReason, setHoldReason] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [billableAmount, setBillableAmount] = useState("");

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setPanel(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  const isOverride = triageCoverage !== p.suggestedCoverage;

  return (
    <div className="grid gap-2">
      {error && <Notice tone="alert">{error}</Notice>}

      {(p.status === "NEW" || p.status === "TRIAGED") && (
        <Button disabled={pending} onClick={() => setPanel("triage")}>
          Triage
        </Button>
      )}
      {(p.status === "TRIAGED" || p.status === "ASSIGNED") && (
        <Button variant="outline" disabled={pending} onClick={() => run(() => p.onStart(p.issueId))}>
          Start
        </Button>
      )}
      {(p.status === "IN_PROGRESS" || p.status === "ASSIGNED") && (
        <>
          <Button variant="outline" disabled={pending} onClick={() => setPanel("hold")}>
            Hold
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => run(() => p.onResolve(p.issueId))}>
            Resolve
          </Button>
        </>
      )}
      {p.status === "ON_HOLD" && (
        <Button disabled={pending} onClick={() => run(() => p.onResume(p.issueId))}>
          Resume
        </Button>
      )}
      {p.status === "RESOLVED" && (
        <Button disabled={pending} onClick={() => setPanel("verify")}>
          Verify
        </Button>
      )}
      {(p.status === "VERIFIED" || p.status === "RESOLVED") && (
        <Button variant="outline" disabled={pending} onClick={() => setPanel("close")}>
          Close
        </Button>
      )}
      {p.coverage === "BILLABLE" &&
        (p.status === "RESOLVED" || p.status === "VERIFIED" || p.status === "CLOSED") && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => p.onBill(p.issueId))}>
            Generate invoice
          </Button>
        )}

      {panel === "triage" && (
        <div className="rounded border p-3 grid gap-2" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="text-xs font-semibold">Triage</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Priority</Label>
              <Select value={triagePriority} onChange={(e) => setTriagePriority(e.target.value as Priority)}>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="P4">P4</option>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={triageCategory}
                onChange={(e) => setTriageCategory(e.target.value as Category)}
              >
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
              <Label>Coverage (auto: {p.suggestedCoverage})</Label>
              <Select
                value={triageCoverage}
                onChange={(e) => setTriageCoverage(e.target.value as Coverage)}
              >
                <option value="AMC">AMC</option>
                <option value="WARRANTY">Warranty</option>
                <option value="GOODWILL">Goodwill</option>
                <option value="BILLABLE">Billable</option>
              </Select>
            </div>
            <div>
              <Label>Assign to</Label>
              <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {p.assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            {isOverride && (
              <div className="sm:col-span-2">
                <Label>Override reason (required)</Label>
                <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              disabled={pending || (isOverride && overrideReason.trim().length < 3)}
              onClick={() =>
                run(() =>
                  p.onTriage(p.issueId, {
                    priority: triagePriority,
                    category: triageCategory,
                    coverage: triageCoverage,
                    coverageOverrideReason: isOverride ? overrideReason : undefined,
                    assignedToUserId: assigneeId || undefined,
                  }),
                )
              }
            >
              Save triage
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {panel === "hold" && (
        <Panel title="Place on hold">
          <Label>Reason</Label>
          <Input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || holdReason.trim().length < 3}
              onClick={() => run(() => p.onHold(p.issueId, holdReason))}
            >
              Hold
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {panel === "verify" && (
        <Panel title="Client sign-off">
          <Label>Sign-off name</Label>
          <Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || signoffName.trim().length < 1}
              onClick={() => run(() => p.onVerify(p.issueId, signoffName))}
            >
              Verify
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {panel === "close" && (
        <Panel title="Close ticket">
          <Label>Sign-off name</Label>
          <Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} />
          <Label>Closure notes</Label>
          <Input value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} />
          {p.coverage === "BILLABLE" && (
            <>
              <Label>Billable amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={billableAmount}
                onChange={(e) => setBillableAmount(e.target.value)}
              />
            </>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || signoffName.trim().length < 1}
              onClick={() =>
                run(() =>
                  p.onClose(p.issueId, {
                    clientSignoffName: signoffName,
                    closureNotes,
                    billableAmount: billableAmount || undefined,
                  }),
                )
              }
            >
              Close
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPanel(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border p-3 grid gap-2" style={{ borderColor: "hsl(var(--border))" }}>
      <div className="text-xs font-semibold">{title}</div>
      {children}
    </div>
  );
}
