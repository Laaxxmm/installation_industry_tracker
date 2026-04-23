"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/sab";

type Props = {
  amcId: string;
  status: string;
  onApprove: (id: string) => Promise<unknown>;
  onHold: (id: string, reason: string) => Promise<unknown>;
  onResume: (id: string) => Promise<unknown>;
  onCancel: (id: string, reason: string) => Promise<unknown>;
  onRenew: (id: string) => Promise<unknown>;
};

export function AMCActions({ amcId, status, onApprove, onHold, onResume, onCancel, onRenew }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"hold" | "cancel" | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="grid gap-2">
      {error && <Notice tone="alert">{error}</Notice>}

      {status === "DRAFT" && (
        <Button disabled={pending} onClick={() => run(() => onApprove(amcId))}>
          Approve & activate
        </Button>
      )}

      {status === "ACTIVE" && (
        <>
          <Button variant="outline" disabled={pending} onClick={() => setMode("hold")}>
            Place on hold
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setMode("cancel")}>
            Cancel contract
          </Button>
        </>
      )}

      {status === "ON_HOLD" && (
        <Button disabled={pending} onClick={() => run(() => onResume(amcId))}>
          Resume
        </Button>
      )}

      {(status === "EXPIRED" || status === "ACTIVE") && (
        <Button variant="outline" disabled={pending} onClick={() => run(() => onRenew(amcId))}>
          Renew (clone for next year)
        </Button>
      )}

      {mode && (
        <div className="grid gap-2 rounded border p-3" style={{ borderColor: "hsl(var(--border))" }}>
          <label className="text-xs font-semibold">
            Reason to {mode === "hold" ? "hold" : "cancel"}
          </label>
          <textarea
            className="w-full rounded border p-2 text-sm"
            style={{ borderColor: "hsl(var(--border))" }}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || reason.trim().length < 3}
              onClick={() =>
                run(() =>
                  mode === "hold"
                    ? onHold(amcId, reason)
                    : onCancel(amcId, reason),
                )
              }
            >
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
