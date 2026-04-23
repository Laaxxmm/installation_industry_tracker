"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatINR, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";

export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  fileNo: string | null;
  poNumber: string | null;
  poDate: string | null;
  fy: string | null;
  poStatus: string | null;
  clientName: string;
  location: string | null;
  description: string | null;
  projectDetails: string | null;
  workStatus: string | null;
  contractValue: string;
  billedValue: string;
  adjBillableValue: string;
  response: string | null;
};

type Filters = {
  code: string;
  poNumber: string;
  poStatus: string;
  fy: string;
  clientName: string;
  location: string;
  description: string;
  projectDetails: string;
  workStatus: string;
  needBill: "" | "yes" | "no";
  hasBilled: "" | "yes" | "no";
  response: string;
  responseNone: "" | "yes";
  poStatusNone: "" | "yes";
  fyNone: "" | "yes";
};

const FILTER_KEYS = [
  "code",
  "poNumber",
  "poStatus",
  "fy",
  "clientName",
  "location",
  "description",
  "projectDetails",
  "workStatus",
  "needBill",
  "hasBilled",
  "response",
  "responseNone",
  "poStatusNone",
  "fyNone",
] as const;

function contains(hay: string | null | undefined, needle: string) {
  if (!needle) return true;
  if (!hay) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const f: Filters = useMemo(
    () => ({
      code: searchParams.get("code") ?? "",
      poNumber: searchParams.get("poNumber") ?? "",
      poStatus: searchParams.get("poStatus") ?? "",
      fy: searchParams.get("fy") ?? "",
      clientName: searchParams.get("clientName") ?? "",
      location: searchParams.get("location") ?? "",
      description: searchParams.get("description") ?? "",
      projectDetails: searchParams.get("projectDetails") ?? "",
      workStatus: searchParams.get("workStatus") ?? "",
      needBill: (searchParams.get("needBill") ?? "") as Filters["needBill"],
      hasBilled: (searchParams.get("hasBilled") ?? "") as Filters["hasBilled"],
      response: searchParams.get("response") ?? "",
      responseNone: (searchParams.get("responseNone") ?? "") as Filters["responseNone"],
      poStatusNone: (searchParams.get("poStatusNone") ?? "") as Filters["poStatusNone"],
      fyNone: (searchParams.get("fyNone") ?? "") as Filters["fyNone"],
    }),
    [searchParams],
  );

  const setFilter = useCallback(
    (key: keyof Filters, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((k) => params.delete(k));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const workStatusOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.workStatus) s.add(r.workStatus);
    });
    return [...s].sort();
  }, [rows]);

  const fyOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.fy) s.add(r.fy);
    });
    return [...s].sort().reverse();
  }, [rows]);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const finalPo = toDecimal(r.contractValue);
        const billed = toDecimal(r.billedValue);
        const adj = toDecimal(r.adjBillableValue);
        const billable = finalPo.minus(billed).minus(adj);
        return {
          r,
          finalPo,
          billed,
          adj,
          billable,
          needBill: billable.greaterThan(0),
          hasBilled: billed.greaterThan(0),
        };
      }),
    [rows],
  );

  const filtered = useMemo(() => {
    return enriched.filter(({ r, needBill, hasBilled }) => {
      if (!contains(r.code, f.code) && !contains(r.name, f.code)) return false;
      if (!contains(r.poNumber, f.poNumber) && !contains(r.fileNo, f.poNumber)) return false;
      if (f.poStatus && r.poStatus !== f.poStatus) return false;
      if (f.poStatusNone === "yes" && r.poStatus) return false;
      if (f.fy && r.fy !== f.fy) return false;
      if (f.fyNone === "yes" && r.fy) return false;
      if (!contains(r.clientName, f.clientName)) return false;
      if (!contains(r.location, f.location)) return false;
      if (!contains(r.description, f.description)) return false;
      if (!contains(r.projectDetails, f.projectDetails)) return false;
      if (f.workStatus && r.workStatus !== f.workStatus) return false;
      if (f.needBill === "yes" && !needBill) return false;
      if (f.needBill === "no" && needBill) return false;
      if (f.hasBilled === "yes" && !hasBilled) return false;
      if (f.hasBilled === "no" && hasBilled) return false;
      if (f.responseNone === "yes" && r.response && r.response.trim()) return false;
      if (!contains(r.response, f.response)) return false;
      return true;
    });
  }, [enriched, f]);

  const hasActiveFilter = Object.values(f).some((v) => v !== "");

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = filtered.map(({ r, finalPo, billed, adj, billable, needBill }) => ({
        Code: r.code,
        Name: r.name,
        "PO Number": r.poNumber ?? "",
        "File No": r.fileNo ?? "",
        "PO Date": r.poDate ? formatIST(new Date(r.poDate), "dd MMM yyyy") : "",
        FY: r.fy ?? "",
        "PO Status": r.poStatus ?? "",
        "Client Name": r.clientName,
        Location: r.location ?? "",
        Description: r.description ?? "",
        "Project Details": r.projectDetails ?? "",
        "Work Status": r.workStatus ?? "",
        "Final PO Value (inc GST)": Number(finalPo.toString()),
        "Billed Value": Number(billed.toString()),
        "Adj Billable Value": Number(adj.toString()),
        "Billable Value": Number(billable.toString()),
        "Need to Make Bill": needBill ? "Yes" : "No",
        Response: r.response ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
        { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 30 },
        { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 16 }, { wch: 30 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Projects");
      const filename = `projects-${formatIST(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(wb, filename);
    } finally {
      setExporting(false);
    }
  }, [filtered]);

  const inputCls =
    "h-7 w-full rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30";
  const selectCls = inputCls + " appearance-none pr-6";

  const showing =
    filtered.length === enriched.length
      ? `${enriched.length} projects`
      : `${filtered.length} of ${enriched.length} shown`;

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
        <span>{showing}</span>
        <div className="flex items-center gap-4">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-brand hover:underline"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filtered.length === 0}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {exporting ? "Exporting…" : "Export XLSX"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2350px] text-[12px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 w-[150px] shadow-[1px_0_0_0_rgb(226,232,240)]">
                Code
              </th>
              <th className="sticky left-[150px] z-20 bg-slate-50 px-2 py-2.5 w-[160px] shadow-[1px_0_0_0_rgb(226,232,240)]">
                PO Number
              </th>
              <th className="px-2 py-2.5">PO Date</th>
              <th className="px-2 py-2.5">FY</th>
              <th className="px-2 py-2.5">PO Status</th>
              <th className="px-2 py-2.5">Client Name</th>
              <th className="px-2 py-2.5">Location</th>
              <th className="px-2 py-2.5">Description</th>
              <th className="px-2 py-2.5">Project Details</th>
              <th className="px-2 py-2.5">Work Status</th>
              <th className="px-2 py-2.5 text-right">Final PO Value (inc GST)</th>
              <th className="px-2 py-2.5 text-right">Billed Value</th>
              <th className="px-2 py-2.5 text-right">Adj Billable Value</th>
              <th className="px-2 py-2.5 text-right">Billable Value</th>
              <th className="px-2 py-2.5">Need to Make Bill</th>
              <th className="px-3 py-2.5">Response</th>
            </tr>
            <tr className="border-b border-slate-200 bg-white">
              <th className="sticky left-0 z-20 bg-white px-3 py-1.5 w-[150px] shadow-[1px_0_0_0_rgb(226,232,240)]">
                <input
                  className={inputCls}
                  placeholder="Code / name"
                  value={f.code}
                  onChange={(e) => setFilter("code", e.target.value)}
                />
              </th>
              <th className="sticky left-[150px] z-20 bg-white px-2 py-1.5 w-[160px] shadow-[1px_0_0_0_rgb(226,232,240)]">
                <input
                  className={inputCls}
                  placeholder="PO / File No"
                  value={f.poNumber}
                  onChange={(e) => setFilter("poNumber", e.target.value)}
                />
              </th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5">
                <select
                  className={selectCls}
                  value={f.fy}
                  onChange={(e) => setFilter("fy", e.target.value)}
                >
                  <option value="">All</option>
                  {fyOptions.map((fy) => (
                    <option key={fy} value={fy}>
                      {fy}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 py-1.5">
                <select
                  className={selectCls}
                  value={f.poStatus}
                  onChange={(e) => setFilter("poStatus", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ISSUED">Issued</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </th>
              <th className="px-2 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Client"
                  value={f.clientName}
                  onChange={(e) => setFilter("clientName", e.target.value)}
                />
              </th>
              <th className="px-2 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Location"
                  value={f.location}
                  onChange={(e) => setFilter("location", e.target.value)}
                />
              </th>
              <th className="px-2 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Description"
                  value={f.description}
                  onChange={(e) => setFilter("description", e.target.value)}
                />
              </th>
              <th className="px-2 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Details"
                  value={f.projectDetails}
                  onChange={(e) => setFilter("projectDetails", e.target.value)}
                />
              </th>
              <th className="px-2 py-1.5">
                <select
                  className={selectCls}
                  value={f.workStatus}
                  onChange={(e) => setFilter("workStatus", e.target.value)}
                >
                  <option value="">All</option>
                  {workStatusOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5">
                <select
                  className={selectCls}
                  value={f.hasBilled}
                  onChange={(e) => setFilter("hasBilled", e.target.value)}
                  title="Has billed value"
                >
                  <option value="">All</option>
                  <option value="yes">Billed</option>
                  <option value="no">Unbilled</option>
                </select>
              </th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5"></th>
              <th className="px-2 py-1.5">
                <select
                  className={selectCls}
                  value={f.needBill}
                  onChange={(e) => setFilter("needBill", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </th>
              <th className="px-3 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Response"
                  value={f.response}
                  onChange={(e) => setFilter("response", e.target.value)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={16}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  No projects match these filters.
                </td>
              </tr>
            )}
            {filtered.map(({ r, finalPo, billed, adj, billable, needBill }) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 last:border-0 align-top"
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-3 w-[150px] shadow-[1px_0_0_0_rgb(241,245,249)]">
                  <div className="flex items-start justify-between gap-1">
                    <Link
                      href={`/projects/${r.id}`}
                      className="font-mono text-[11px] font-medium text-brand hover:underline"
                    >
                      {r.code}
                    </Link>
                    <Link
                      href={`/projects/${r.id}/edit`}
                      title="Edit project"
                      className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-brand"
                    >
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500 break-words">
                    {r.name}
                  </div>
                </td>
                <td className="sticky left-[150px] z-10 bg-white px-2 py-3 w-[160px] whitespace-nowrap shadow-[1px_0_0_0_rgb(241,245,249)]">
                  <div className="font-mono text-[11px] text-slate-800">
                    {r.poNumber ?? "—"}
                  </div>
                  {r.fileNo && (
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {r.fileNo}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3 text-slate-700 whitespace-nowrap">
                  {r.poDate ? formatIST(new Date(r.poDate), "dd MMM yyyy") : "—"}
                </td>
                <td className="px-2 py-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                  {r.fy ?? "—"}
                </td>
                <td className="px-2 py-3">
                  {r.poStatus ? <StatusBadge status={r.poStatus} /> : "—"}
                </td>
                <td className="px-2 py-3 text-slate-800">{r.clientName}</td>
                <td className="px-2 py-3 text-slate-700">{r.location ?? "—"}</td>
                <td className="px-2 py-3 text-slate-700 max-w-[220px]">
                  {r.description ?? "—"}
                </td>
                <td className="px-2 py-3 text-slate-700 max-w-[260px] whitespace-pre-wrap">
                  {r.projectDetails ?? "—"}
                </td>
                <td className="px-2 py-3 text-slate-700">{r.workStatus ?? "—"}</td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                  {formatINR(finalPo)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                  {formatINR(billed)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                  {formatINR(adj)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                  {formatINR(billable)}
                </td>
                <td className="px-2 py-3 whitespace-nowrap">
                  {needBill ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                      No
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-700 max-w-[240px] whitespace-pre-wrap">
                  {r.response ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
