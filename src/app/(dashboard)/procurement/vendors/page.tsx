import Link from "next/link";
import { Plus } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader, KPI, Pill, Code, inr } from "@/components/sab";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const CATEGORY_LABEL: Record<string, string> = {
  PIPES: "Pipes",
  FITTINGS: "Fittings",
  PUMPS: "Pumps",
  VALVES: "Valves",
  SPRINKLERS: "Sprinklers",
  TOOLS: "Tools",
  CONSUMABLES: "Consumables",
  SERVICES: "Services",
  OTHER: "Other",
};

const TERMS_LABEL: Record<string, string> = {
  NET_15: "Net 15",
  NET_30: "Net 30",
  NET_45: "Net 45",
  NET_60: "Net 60",
  ADVANCE: "Advance",
};

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const category = sp.category?.trim() ?? "";

  // Filter clauses translated into Prisma where filters. Search matches
  // against vendor name OR code (case-insensitive); category narrows by
  // enum.
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(category ? { category: category as never } : {}),
  };

  const [vendors, totalCount, msmeCount] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 300,
      include: {
        _count: { select: { purchaseOrders: true, bills: true } },
        bills: {
          where: { status: { in: ["PENDING_MATCH", "MATCHED", "APPROVED", "OVERDUE"] } },
          select: { grandTotal: true, amountPaid: true },
        },
      },
    }),
    db.vendor.count(),
    db.vendor.count({ where: { msme: true } }),
  ]);

  // Outstanding = unpaid portion of bills still in the AP queue.
  const rowsWithTotals = vendors.map((v) => {
    const outstanding = v.bills.reduce(
      (acc, b) => acc + Number(b.grandTotal) - Number(b.amountPaid),
      0,
    );
    return { ...v, outstanding };
  });

  const totalOutstanding = rowsWithTotals.reduce((a, v) => a + v.outstanding, 0);
  const msmeShare = totalCount ? Math.round((msmeCount / totalCount) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Vendors"
        description={`${totalCount} suppliers · ${msmeCount} MSME · ${inr(totalOutstanding)} outstanding payables`}
        actions={
          canCreate ? (
            <Link href="/procurement/vendors/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New vendor
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Active vendors" value={totalCount} sub={`${msmeCount} MSME registered`} accent />
        <KPI label="Outstanding payables" value={inr(totalOutstanding)} sub="across all vendors" />
        <KPI label="MSME share" value={`${msmeShare}%`} sub="protected payment SLA" />
        <KPI
          label="Active POs"
          value={rowsWithTotals.reduce((a, v) => a + v._count.purchaseOrders, 0)}
          sub="across all vendors"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput current={q} placeholder="Search vendor name or code…" />
        <TableSelectFilter
          paramName="category"
          label="Category"
          current={category}
          options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || category) && (
          <span className="text-[11px] text-slate-500">
            {vendors.length} of {totalCount} vendor{totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div
        className="overflow-hidden rounded border"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <table className="w-full text-[12.5px] sab-tabular">
          <thead>
            <tr
              className="border-b"
              style={{ background: "var(--sab-paper-alt)", borderColor: "hsl(var(--border))" }}
            >
              {["Vendor", "Category", "State", "GSTIN", "Outstanding", "Terms", "POs"].map((h, i) => (
                <th
                  key={h}
                  className={`sab-caps px-3 py-2.5 ${
                    i === 4 ? "text-right" : "text-left"
                  }`}
                  style={{ color: "var(--sab-ink3)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsWithTotals.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px]"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  No vendors yet.{" "}
                  {canCreate && (
                    <Link
                      href="/procurement/vendors/new"
                      className="underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Add the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {rowsWithTotals.map((v) => (
              <tr
                key={v.id}
                className="border-b transition-colors hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/procurement/vendors/${v.id}`}
                    className="block font-semibold"
                    style={{ color: "var(--sab-ink)" }}
                  >
                    {v.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 sab-code" style={{ fontSize: 10 }}>
                    <span>{v.code}</span>
                    <span>·</span>
                    <span>{v.contactName ?? "—"}</span>
                    {!v.active && (
                      <Pill tone="ink" size="sm">
                        Archived
                      </Pill>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {CATEGORY_LABEL[v.category] ?? v.category}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  <span>{v.stateCode}</span>
                  {v.msme && (
                    <Pill tone="accent" size="sm" className="ml-2">
                      MSME
                    </Pill>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {v.gstin ? <Code>{v.gstin}</Code> : <span style={{ color: "var(--sab-ink4)" }}>—</span>}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-mono font-semibold"
                  style={{ color: v.outstanding > 0 ? "var(--sab-ink)" : "var(--sab-ink3)" }}
                >
                  {v.outstanding > 0 ? inr(v.outstanding) : "—"}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {TERMS_LABEL[v.paymentTerms] ?? v.paymentTerms}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--sab-ink)" }}>
                  {v._count.purchaseOrders}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
