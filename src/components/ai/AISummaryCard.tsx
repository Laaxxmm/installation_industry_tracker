"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// On-demand AI summary card. Hits `endpoint` (GET) and renders the returned
// `{ summary: string }` as a paragraph. We don't auto-fetch — user has to ask
// so we don't burn tokens on every page load.

export function AISummaryCard({
  endpoint,
  label = "AI summary",
}: {
  endpoint: string;
  label?: string;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { summary: string };
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="rounded border p-4"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={run}
          disabled={loading}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {loading
            ? "Summarising…"
            : summary
              ? "Regenerate"
              : "Summarise"}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      )}
      {summary && !error && (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--foreground))]">
          {summary}
        </p>
      )}
      {!summary && !error && !loading && (
        <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
          Click Summarise to generate a 3-5 sentence snapshot.
        </p>
      )}
    </section>
  );
}
