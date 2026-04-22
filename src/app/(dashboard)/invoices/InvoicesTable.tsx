"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatINR, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  invoiceNo: string | null;
  kind: string;
  status: string;
  clientName: string;
  projectCode: string;
  projectName: string;
  issuedAt: string | null;
  fy: string | null;
  grandTotal: string;
  amountPaid: string;
};

const STATUS_PILL: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const KIND_PILL: Record<string, string> = {
  ADVANCE: "bg-amber-100 text-amber-800",
  PROGRESS: "bg-sky-100 text-sky-800",
  FINAL: "bg-emerald-100 text-emerald-800",
  ADHOC: "bg-slate-100 text-slate-700",
};

type Filters = {
  invoice: string;
  kind: string;
  client: string;
  project: string;
  status: string;
  statusIn: string;
  issued: string;
  fyLabel: string;
};

const FILTER_KEYS = [
  "invoice",
  "kind",
  "client",
  "project",
  "status",
  "statusIn",
  "issued",
  "fyLabel",
] as const;

function contains(hay: string | null | undefined, needle: string) {
  if (!needle) return true;
  if (!hay) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function InvoicesTable({
  rows,
}: {
  rows: InvoiceRow[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const f: Filters = useMemo(
    () => ({
      invoice: searchParams.get("invoice") ?? "",
      kind: searchParams.get("kind") ?? "",
      client: searchParams.get("client") ?? "",
      project: searchParams.get("project") ?? "",
      status: searchParams.get("status") ?? "",
      statusIn: searchParams.get("statusIn") ?? "",
      issued: searchParams.get("issued") ?? "",
      fyLabel: searchParams.get("fyLabel") ?? "",
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

  const fyOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.fy) s.add(r.fy);
    });
    return [...s].sort().reverse();
  }, [rows]);
  const statusInSet = useMemo(
    () =>
      f.statusIn
        ? new Set(f.statusIn.split(",").map((s) => s.trim()).filter(Boolean))
        : null,
    [f.statusIn],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const invoiceLabel = r.status === "DRAFT" ? "DRAFT" : r.invoiceNo ?? "";
      if (!contains(invoiceLabel, f.invoice)) return false;
      if (f.kind && r.kind !== f.kind) return false;
      if (!contains(r.clientName, f.client)) return false;
      if (
        !contains(r.projectCode, f.project) &&
        !contains(r.projectName, f.project)
      )
        return false;
      if (f.status && r.status !== f.status) return false;
      if (statusInSet && !statusInSet.has(r.status)) return false;
      if (f.issued) {
        const issuedStr = r.issuedAt
          ? formatIST(new Date(r.issuedAt), "dd-MM-yyyy")
          : "";
        if (!issuedStr.toLowerCase().includes(f.issued.toLowerCase())) return false;
      }
      if (f.fyLabel && r.fy !== f.fyLabel) return false;
      return true;
    });
  }, [rows, f, statusInSet]);

  const hasActiveFilter = Object.values(f).some((v) => v !== "");
  const showing =
    filtered.length === rows.length
      ? `${rows.length} invoices`
      : `${filtered.length} of ${rows.length} shown`;

  const inputCls =
    "h-7 w-full rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30";
  const selectCls = inputCls + " appearance-none pr-6";

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
        <span>{showing}</span>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-brand hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5">Invoice</th>
              <th className="px-4 py-2.5">Kind</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Project</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Issued</th>
              <th className="px-4 py-2.5">FY</th>
              <th className="px-4 py-2.5 text-right">Grand total</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
            </tr>
            <tr className="border-b border-slate-200 bg-white">
              <th className="px-4 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Invoice #"
                  value={f.invoice}
                  onChange={(e) => setFilter("invoice", e.target.value)}
                />
              </th>
              <th className="px-4 py-1.5">
                <select
                  className={selectCls}
                  value={f.kind}
                  onChange={(e) => setFilter("kind", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="ADVANCE">Advance</option>
                  <option value="PROGRESS">Progress</option>
                  <option value="FINAL">Final</option>
                  <option value="ADHOC">Adhoc</option>
                </select>
              </th>
              <th className="px-4 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Client"
                  value={f.client}
                  onChange={(e) => setFilter("client", e.target.value)}
                />
              </th>
              <th className="px-4 py-1.5">
                <input
                  className={inputCls}
                  placeholder="Code / name"
                  value={f.project}
                  onChange={(e) => setFilter("project", e.target.value)}
                />
              </th>
              <th className="px-4 py-1.5">
                <select
                  className={selectCls}
                  value={f.status}
                  onChange={(e) => setFilter("status", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ISSUED">Issued</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </th>
              <th className="px-4 py-1.5">
                <input
                  className={inputCls}
                  placeholder="dd-mm-yyyy"
                  value={f.issued}
                  onChange={(e) => setFilter("issued", e.target.value)}
                />
              </th>
              <th className="px-4 py-1.5">
                <select
                  className={selectCls}
                  value={f.fyLabel}
                  onChange={(e) => setFilter("fyLabel", e.target.value)}
                >
                  <option value="">All</option>
                  {fyOptions.map((fy) => (
                    <option key={fy} value={fy}>
                      {fy}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 py-1.5"></th>
              <th className="px-4 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-[12px] text-slate-500"
                >
                  {rows.length === 0
                    ? "No invoices yet. Create one from a project."
                    : "No invoices match these filters."}
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const grand = toDecimal(i.grandTotal);
              const paid = toDecimal(i.amountPaid);
              return (
                <tr
                  key={i.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    <Link
                      href={`/invoices/${i.id}`}
                      className="font-semibold text-brand hover:underline"
                    >
                      {i.status === "DRAFT" ? "DRAFT" : i.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        KIND_PILL[i.kind] ?? "bg-slate-100 text-slate-700",
                      )}
                    >
                      {i.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{i.clientName}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-600">
                    <span className="font-mono">{i.projectCode}</span> ·{" "}
                    {i.projectName}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        STATUS_PILL[i.status] ?? "bg-slate-100 text-slate-700",
                      )}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-600">
                    {i.issuedAt
                      ? formatIST(new Date(i.issuedAt), "dd-MM-yyyy")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-mono text-slate-700">
                    {i.fy ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatINR(grand)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {i.status === "PAID" ? (
                      <span className="text-emerald-700">Paid</span>
                    ) : i.status === "CANCELLED" ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatINR(grand.minus(paid))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
