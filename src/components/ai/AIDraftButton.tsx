"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Reusable draft button dropped next to form-heavy pages. Opens a small dialog
// with a free-text brief, POSTs to `endpoint` with {brief, ...context}, and
// hands the Zod-validated result to `onDraft`. The form is always the one
// committing data — this primitive never saves anything.

type Props<T> = {
  endpoint: string;
  context?: Record<string, unknown>;
  label?: string;
  title?: string;
  placeholder?: string;
  onDraft: (result: T) => void;
  disabled?: boolean;
  minBriefLength?: number;
};

export function AIDraftButton<T>({
  endpoint,
  context,
  label = "Draft with AI",
  title = "Draft with AI",
  placeholder = "E.g. 12 sprinkler heads at Apollo Hospital, ₹40L budget, 6-week timeline",
  onDraft,
  disabled,
  minBriefLength = 10,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (brief.trim().length < minBriefLength) {
      toast.error(`Brief must be at least ${minBriefLength} characters`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: brief.trim(), ...(context ?? {}) }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as T;
      onDraft(data);
      setOpen(false);
      setBrief("");
      toast.success("Draft loaded — review before saving");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => !submitting && setOpen(v)}
        title={title}
        description="Describe in plain English — I'll pre-fill the form. You review before saving."
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="ai-brief" className="mb-1 block text-[12px]">
              Brief
            </Label>
            <Textarea
              id="ai-brief"
              rows={5}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              ⌘/Ctrl + Enter to draft · grounded in live client and project data
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={submitting || brief.trim().length < minBriefLength}
            >
              {submitting ? "Drafting…" : "Draft"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
