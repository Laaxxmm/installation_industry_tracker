"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createProject, updateProject } from "@/server/actions/projects";

type ProjectFormValues = {
  name: string;
  clientName: string;
  contractValue: string;
  startDate: string;
  siteSupervisorId: string;
  fileNo: string;
  poNumber: string;
  poDate: string;
  poStatus: string;
  location: string;
  description: string;
  projectDetails: string;
  workStatus: string;
  billedValue: string;
  adjBillableValue: string;
  response: string;
};

const emptyValues: ProjectFormValues = {
  name: "",
  clientName: "",
  contractValue: "",
  startDate: "",
  siteSupervisorId: "",
  fileNo: "",
  poNumber: "",
  poDate: "",
  poStatus: "",
  location: "",
  description: "",
  projectDetails: "",
  workStatus: "",
  billedValue: "",
  adjBillableValue: "",
  response: "",
};

export function NewProjectForm({
  supervisors,
  projectId,
  initial,
}: {
  supervisors: Array<{ id: string; name: string }>;
  projectId?: string;
  initial?: Partial<ProjectFormValues>;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ProjectFormValues>({
    ...emptyValues,
    ...initial,
  });
  const router = useRouter();
  const isEdit = !!projectId;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const payload = {
          name: form.name,
          clientName: form.clientName,
          contractValue: form.contractValue,
          startDate: form.startDate
            ? new Date(`${form.startDate}T00:00:00Z`).toISOString()
            : null,
          siteSupervisorId: form.siteSupervisorId || null,
          poDate: form.poDate
            ? new Date(`${form.poDate}T00:00:00Z`).toISOString()
            : null,
          poStatus: form.poStatus || null,
          poNumber: form.poNumber || null,
          fileNo: form.fileNo || null,
          location: form.location || null,
          description: form.description || null,
          projectDetails: form.projectDetails || null,
          workStatus: form.workStatus || null,
          billedValue: form.billedValue || "0",
          adjBillableValue: form.adjBillableValue || "0",
          response: form.response || null,
        };
        if (isEdit && projectId) {
          const project = await updateProject(projectId, payload);
          toast.success(`Project ${project.code} updated`);
          router.push(`/projects/${project.id}`);
          router.refresh();
        } else {
          const project = await createProject(payload);
          toast.success(`Project ${project.code} created`);
          router.push(`/projects/${project.id}`);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : isEdit ? "Update failed" : "Create failed",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clientName">Client</Label>
        <Input
          id="clientName"
          required
          value={form.clientName}
          onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fileNo">File No</Label>
          <Input
            id="fileNo"
            placeholder="e.g. F104"
            value={form.fileNo}
            onChange={(e) => setForm((f) => ({ ...f, fileNo: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poNumber">PO number</Label>
          <Input
            id="poNumber"
            placeholder="e.g. 4700006123"
            value={form.poNumber}
            onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="poDate">PO date</Label>
          <Input
            id="poDate"
            type="date"
            value={form.poDate}
            onChange={(e) => setForm((f) => ({ ...f, poDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poStatus">PO status</Label>
          <Select
            id="poStatus"
            value={form.poStatus}
            onChange={(e) => setForm((f) => ({ ...f, poStatus: e.target.value }))}
          >
            <option value="">— not set —</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="City / site address"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="Short summary"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="projectDetails">Project details</Label>
        <textarea
          id="projectDetails"
          rows={3}
          className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          value={form.projectDetails}
          onChange={(e) =>
            setForm((f) => ({ ...f, projectDetails: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workStatus">Work status</Label>
        <Input
          id="workStatus"
          placeholder="e.g. Dispatched, On-site, Handover pending"
          value={form.workStatus}
          onChange={(e) => setForm((f) => ({ ...f, workStatus: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contractValue">Final PO value inc GST (₹)</Label>
          <Input
            id="contractValue"
            type="number"
            step="0.01"
            min="0"
            required
            value={form.contractValue}
            onChange={(e) => setForm((f) => ({ ...f, contractValue: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billedValue">Billed value (₹)</Label>
          <Input
            id="billedValue"
            type="number"
            step="0.01"
            value={form.billedValue}
            onChange={(e) =>
              setForm((f) => ({ ...f, billedValue: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="adjBillableValue">Adj. billable value (₹)</Label>
          <Input
            id="adjBillableValue"
            type="number"
            step="0.01"
            value={form.adjBillableValue}
            onChange={(e) =>
              setForm((f) => ({ ...f, adjBillableValue: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="supervisor">Site supervisor</Label>
          <Select
            id="supervisor"
            value={form.siteSupervisorId}
            onChange={(e) => setForm((f) => ({ ...f, siteSupervisorId: e.target.value }))}
          >
            <option value="">— unassigned —</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="response">Response</Label>
        <textarea
          id="response"
          rows={2}
          placeholder="Client response / follow-up notes"
          className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          value={form.response}
          onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending} size="default">
          {pending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create project"}
        </Button>
      </div>
    </form>
  );
}
