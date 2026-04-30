import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, VendorPOStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader, KPI, Code, inr, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const PO_STATUS_LABELS: Record<VendorPOStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";

  const where = {
    ...(q
      ? {
          OR: [
            { poNo: { contains: q, mode: "insensitive" as const } },
            { vendor: { name: { contains: q, mode: "insensitive" as const } } },
            { project: { code: { contains: q, mode: "insensitive" as const } } },
            { project: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { status: status as VendorPOStatus } : {}),
  };

  const [pos, totalCount] = await Promise.all([
    db.vendorPO.findMany({
      where,
      orderBy: { issueDate: "desc" },
      take: 200,
      include: {
        vendor: { select: { code: true, name: true, msme: true } },
        project: { select: { code: true, name: true } },
        _count: { select: { lines: true, grns: true } },
      },
    }),
    db.vendorPO.count(),
  ]);

  const open = pos.filter((p) =>
    ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(p.status),
  );
  const pending = pos.filter((p) => p.status === "PENDING_APPROVAL");
  const awaitingReceipt = pos.filter((p) =>
    ["SENT", "PARTIALLY_RECEIVED"].includes(p.status),
  );

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthValue = pos
    .filter((p) => p.issueDate >= startOfMonth)
    .reduce((a, p) => a + Number(p.grandTotal), 0);
  const openValue = open.reduce((a, p) => a + Number(p.grandTotal), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase orders"
        description={`${pos.length} POs · ${pending.length} pending approval · ${inr(openValue)} open value`}
        actions={
          canCreate ? (
            <Link href="/procurement/purchase-orders/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New PO
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Open POs" value={open.length} sub={inr(openValue)} accent />
        <KPI label="Pending approval" value={pending.length} sub="awaiting sign-off" />
        <KPI
          label="Awaiting receipt"
          value={awaitingReceipt.length}
          sub="sent to vendor"
        />
        <KPI label="This month" value={inr(thisMonthValue)} sub="PO value raised" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search PO no, vendor, or project…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status) && (
          <span className="text-[11px] text-slate-500">
            {pos.length} of {totalCount} PO{totalCount === 1 ? "" : "s"}
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
              {["PO", "Vendor", "Project", "Issued", "Status", "Lines", "Value"].map((h, i) => (
                <th
                  key={h}
                  className={`sab-caps px-3 py-2.5 ${i === 6 ? "text-right" : "text-left"}`}
                  style={{ color: "var(--sab-ink3)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px]"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  No purchase orders yet.{" "}
                  {canCreate && (
                    <Link
                      href="/procurement/purchase-orders/new"
                      className="underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Raise the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {pos.map((p) => (
              <tr
                key={p.id}
                className="border-b transition-colors hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/procurement/purchase-orders/${p.id}`}
                    style={{ color: "var(--sab-accent-ink)" }}
                  >
                    <Code>{p.poNo}</Code>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/procurement/vendors/${p.vendorId}`}
                    style={{ color: "var(--sab-ink)" }}
                  >
                    {p.vendor.name}
                  </Link>
                  <div className="mt-0.5 sab-code" style={{ fontSize: 10, color: "var(--sab-ink3)" }}>
                    {p.vendor.code}
                    {p.vendor.msme && <span> · MSME</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {p.project ? (
                    <Link
                      href={`/projects/${p.projectId}`}
                      style={{ color: "var(--sab-ink2)" }}
                    >
                      {p.project.code}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--sab-ink4)" }}>—</span>
                  )}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {fmtDate(p.issueDate)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--sab-ink2)" }}>
                  {p._count.lines}
                  {p._count.grns > 0 && (
                    <span style={{ color: "var(--sab-ink3)" }}> / {p._count.grns} GRN</span>
                  )}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-mono font-semibold"
                  style={{ color: "var(--sab-ink)" }}
                >
                  {inr(p.grandTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pos.length >= 200 && totalCount > pos.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing 200 of {totalCount} purchase orders. Refine search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
