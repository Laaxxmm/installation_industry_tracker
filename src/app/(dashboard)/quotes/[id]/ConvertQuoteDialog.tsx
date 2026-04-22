"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertQuoteToProject } from "@/server/actions/purchase-orders";

export function ConvertQuoteDialog({
  quoteId,
  onClose,
}: {
  quoteId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Planned start and end dates are required");
      return;
    }
    startTransition(async () => {
      try {
        const r = await convertQuoteToProject({
          quoteId,
          projectName: projectName.trim(),
          startDate: new Date(`${startDate}T00:00:00Z`).toISOString(),
          endDate: new Date(`${endDate}T00:00:00Z`).toISOString(),
        });
        toast.success(`Project ${r.project.code} created · ${r.po.poNo} issued`);
        router.push(`/projects/${r.project.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Conversion failed");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-[14px] font-semibold text-slate-900">
            Convert quote to project
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Creates a project, seeds the budget from quote lines, and issues an internal Work Order.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="projectName">Project name</Label>
            <Input
              id="projectName"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Planned start</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Planned end</Label>
              <Input
                id="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} variant="success">
              {pending ? "Converting…" : "Convert"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
