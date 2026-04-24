"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VendorBillAnomalyOutput } from "@/lib/ai/anomaly";

const SEVERITY_TONE: Record<
  "LOW" | "MEDIUM" | "HIGH",
  { bg: string; fg: string; icon: typeof Info }
> = {
  LOW: { bg: "rgba(59,130,246,0.08)", fg: "rgb(37,99,235)", icon: Info },
  MEDIUM: { bg: "rgba(234,179,8,0.10)", fg: "rgb(161,98,7)", icon: AlertCircle },
  HIGH: { bg: "rgba(193,50,48,0.08)", fg: "rgb(153,27,27)", icon: AlertTriangle },
};

const ASSESSMENT_TONE: Record<
  VendorBillAnomalyOutput["overallAssessment"],
  string
> = {
  CLEAN: "rgb(22,101,52)",
  MINOR: "rgb(37,99,235)",
  REVIEW: "rgb(161,98,7)",
  REJECT: "rgb(153,27,27)",
};

export function VendorBillAnomalyCard({ billId }: { billId: string }) {
  const [data, setData] = useState<VendorBillAnomalyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/anomaly/vendor-bill/${billId}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const parsed = (await res.json()) as VendorBillAnomalyOutput;
      setData(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="mb-5 rounded border p-4"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="sab-caps" style={{ color: "var(--sab-ink3)" }}>
            AI anomaly scan
          </div>
          <h3 className="text-[14px] font-semibold">Three-way match review</h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={run}
          disabled={loading}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {loading ? "Scanning…" : data ? "Rescan" : "Scan for anomalies"}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-red-600">{error}</p>
      )}

      {data && (
        <div className="mt-3 space-y-3">
          <div
            className="flex items-center justify-between rounded border px-3 py-2"
            style={{
              borderColor: "hsl(var(--border))",
              background: "var(--sab-paper-alt)",
            }}
          >
            <div className="text-[12.5px]" style={{ color: "var(--sab-ink2)" }}>
              {data.summary}
            </div>
            <span
              className="ml-3 rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                color: ASSESSMENT_TONE[data.overallAssessment],
                border: `1px solid ${ASSESSMENT_TONE[data.overallAssessment]}`,
              }}
            >
              {data.overallAssessment}
            </span>
          </div>

          {data.flags.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--sab-ink3)" }}>
              No flags raised.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.flags.map((f, i) => {
                const tone = SEVERITY_TONE[f.severity];
                const Icon = tone.icon;
                return (
                  <li
                    key={i}
                    className="rounded border px-3 py-2"
                    style={{
                      borderColor: "hsl(var(--border))",
                      background: tone.bg,
                    }}
                  >
                    <div
                      className="flex items-center gap-2 text-[13px] font-semibold"
                      style={{ color: tone.fg }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{f.title}</span>
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider">
                        {f.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px]" style={{ color: "var(--sab-ink2)" }}>
                      {f.detail}
                    </p>
                    {f.evidence && (
                      <p
                        className="mt-1 text-[11px]"
                        style={{ color: "var(--sab-ink3)" }}
                      >
                        Evidence: {f.evidence}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!data && !error && !loading && (
        <p className="mt-3 text-[12px]" style={{ color: "var(--sab-ink3)" }}>
          Run an AI review to flag line-level price drift, qty-vs-GRN
          mismatches, duplicate entries, round-number padding, and GST
          anomalies.
        </p>
      )}
    </section>
  );
}
