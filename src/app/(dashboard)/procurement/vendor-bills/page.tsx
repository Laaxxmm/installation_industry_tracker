import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, VendorBillStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader, KPI, Code, inr, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const VENDOR_BILL_STATUS_LABELS: Record<VendorBillStatus, string> = {
  DRAFT: "Draft",
  PENDING_MATCH: "Pending match",
  MATCHED: "Matched",
  DISCREPANCY: "Discrepancy",
  APPROVED: "Approved",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export default async function VendorBillsPage({
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
            { billNo: { contains: q, mode: "insensitive" as const } },
            { vendorBillNo: { contains: q, mode: "insensitive" as const } },
            { vendor: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { status: status as VendorBillStatus } : {}),
  };

  const bills = await db.vendorBill.findMany({
    where,
    orderBy: { issueDate: "desc" },
    take: 200,
    include: {
      vendor: { select: { id: true, code: true, name: true, msme: true } },
      po: { select: { poNo: true } },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pending = bills.filter((b) => b.status === "PENDING_MATCH");
  const discrepancy = bills.filter((b) => b.status === "DISCREPANCY");
  const unpaid = bills.filter((b) => ["MATCHED", "APPROVED", "OVERDUE"].includes(b.status));
  const overdue = bills.filter(
    (b) => b.dueDate && b.dueDate < today && !["PAID", "DRAFT"].includes(b.status),
  );

  const unpaidValue = unpaid.reduce(
    (a, b) => a + Number(b.grandTotal) - Number(b.amountPaid),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Vendor bills"
        description={`${bills.length} bills · ${pending.length} awaiting match · ${discrepancy.length} in discrepancy`}
        actions={
          canCreate ? (
            <Link href="/procurement/vendor-bills/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New bill
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Unpaid" value={inr(unpaidValue)} sub={`${unpaid.length} bills`} accent />
        <KPI label="Pending 3-way match" value={pending.length} sub="awaiting GRN match" />
        <KPI label="Discrepancy" value={discrepancy.length} sub="amount mismatch" />
        <KPI label="Overdue" value={overdue.length} sub="past due date" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search bill no, vendor invoice, or supplier…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(VENDOR_BILL_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status) && (
          <span className="text-[11px] text-slate-500">
            {bills.length} bill{bills.length === 1 ? "" : "s"} matching
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
              {["Bill", "Vendor ref", "Vendor", "PO", "Issued", "Due", "Status", "Amount"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`sab-caps px-3 py-2.5 ${i === 7 ? "text-right" : "text-left"}`}
                    style={{ color: "var(--sab-ink3)" }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-[13px]"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  No vendor bills on file.{" "}
                  {canCreate && (
                    <Link
                      href="/procurement/vendor-bills/new"
                      className="underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Enter the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {bills.map((b) => {
              const isOverdue =
                b.dueDate &&
                b.dueDate < today &&
                !["PAID", "DRAFT"].includes(b.status);
              return (
                <tr
                  key={b.id}
                  className="border-b transition-colors hover:bg-[hsl(var(--secondary))]/60"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/procurement/vendor-bills/${b.id}`}
                      style={{ color: "var(--sab-accent-ink)" }}
                    >
                      <Code>{b.billNo}</Code>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                    {b.vendorBillNo ? <Code>{b.vendorBillNo}</Code> : <span style={{ color: "var(--sab-ink4)" }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/procurement/vendors/${b.vendor.id}`}
                      style={{ color: "var(--sab-ink)" }}
                    >
                      {b.vendor.name}
                    </Link>
                    {b.vendor.msme && (
                      <span
                        className="ml-2 text-[10px]"
                        style={{ color: "var(--sab-accent-ink)" }}
                      >
                        MSME
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                    {b.po ? (
                      <Link
                        href={`/procurement/purchase-orders/${b.poId}`}
                        style={{ color: "var(--sab-ink2)" }}
                      >
                        <Code>{b.po.poNo}</Code>
                      </Link>
                    ) : (
                      <span style={{ color: "var(--sab-ink4)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                    {fmtDate(b.issueDate)}
                  </td>
                  <td
                    className="px-3 py-2.5"
                    style={{ color: isOverdue ? "var(--sab-alert)" : "var(--sab-ink2)" }}
                  >
                    {b.dueDate ? fmtDate(b.dueDate) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={isOverdue ? "OVERDUE" : b.status} />
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-mono font-semibold"
                    style={{ color: "var(--sab-ink)" }}
                  >
                    {inr(b.grandTotal)}
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
