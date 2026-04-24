import { notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import {
  matchVendorBill,
  approveVendorBill,
  markVendorBillPaid,
} from "@/server/actions/procurement";
import { PageHeader, KPI, Pill, Code, inr, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";
import { BillActions } from "./BillActions";
import { VendorBillAnomalyCard } from "@/components/ai/VendorBillAnomalyCard";

export default async function VendorBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canAct = hasRole(session, [Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const bill = await db.vendorBill.findUnique({
    where: { id },
    include: {
      vendor: true,
      po: { select: { id: true, poNo: true, grandTotal: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      matchedBy: { select: { name: true, email: true } },
    },
  });
  if (!bill) notFound();

  async function handleMatch() {
    "use server";
    await matchVendorBill(bill!.id);
  }
  async function handleApprove() {
    "use server";
    await approveVendorBill(bill!.id);
  }
  async function handlePay() {
    "use server";
    await markVendorBillPaid(bill!.id);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    bill.dueDate && bill.dueDate < today && !["PAID", "DRAFT"].includes(bill.status);
  const remaining = Number(bill.grandTotal) - Number(bill.amountPaid);

  return (
    <div>
      <div
        className="sab-caps mb-4 flex items-center gap-2"
        style={{ color: "var(--sab-ink3)" }}
      >
        <Link href="/procurement/vendor-bills">Vendor bills</Link>
        <span>·</span>
        <span style={{ color: "var(--sab-ink)" }}>{bill.billNo}</span>
      </div>
      <PageHeader
        eyebrow={bill.billNo}
        title={`Bill from ${bill.vendor.name}`}
        description={[
          `Issued ${fmtDate(bill.issueDate)}`,
          bill.dueDate ? `Due ${fmtDate(bill.dueDate)}` : null,
          bill.vendorBillNo ? `Vendor ref ${bill.vendorBillNo}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canAct ? (
            <BillActions
              status={bill.status}
              hasPO={Boolean(bill.poId)}
              onMatch={handleMatch}
              onApprove={handleApprove}
              onPay={handlePay}
            />
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={isOverdue ? "OVERDUE" : bill.status} />
        {bill.vendor.msme && (
          <Pill tone="accent" size="sm" dot>
            MSME · protected SLA
          </Pill>
        )}
        {bill.matchedBy && (
          <span className="text-[12px]" style={{ color: "var(--sab-ink3)" }}>
            Matched by {bill.matchedBy.name ?? bill.matchedBy.email}
            {bill.matchedAt && ` on ${fmtDate(bill.matchedAt)}`}
          </span>
        )}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <KPI label="Subtotal" value={inr(bill.subtotal)} sub="before tax" />
        <KPI label="GST" value={inr(bill.taxTotal)} sub={`${bill.lines.length} lines`} />
        <KPI label="Grand total" value={inr(bill.grandTotal)} accent />
        <KPI
          label="Outstanding"
          value={inr(remaining)}
          sub={
            bill.status === "PAID"
              ? `Paid ${fmtDate(bill.paidAt ?? bill.issueDate)}`
              : "unpaid"
          }
        />
      </div>

      {canAct && <VendorBillAnomalyCard billId={bill.id} />}

      {bill.discrepancyNote && (
        <div
          className="mb-5 rounded border p-4"
          style={{
            background: "rgba(193,50,48,0.05)",
            borderColor: "hsl(var(--border))",
            color: "var(--sab-alert)",
          }}
        >
          <div className="sab-caps mb-1">Discrepancy</div>
          <div className="text-[13px]">{bill.discrepancyNote}</div>
        </div>
      )}

      {bill.po && (
        <div
          className="mb-5 rounded border p-4"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <div className="sab-caps mb-1" style={{ color: "var(--sab-ink3)" }}>
            Linked to PO
          </div>
          <div className="flex items-center justify-between">
            <Link
              href={`/procurement/purchase-orders/${bill.po.id}`}
              style={{ color: "var(--sab-accent-ink)" }}
            >
              <Code>{bill.po.poNo}</Code>
            </Link>
            <div className="text-[12.5px]" style={{ color: "var(--sab-ink2)" }}>
              PO total {inr(bill.po.grandTotal)}
            </div>
          </div>
        </div>
      )}

      <section
        className="rounded border"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <header className="border-b px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="sab-caps">Bill lines</div>
          <h2 className="mt-0.5 text-[15px] font-semibold">
            {bill.lines.length} lines · {inr(bill.grandTotal)} total
          </h2>
        </header>
        <table className="w-full text-[12.5px] sab-tabular">
          <thead>
            <tr
              className="border-b"
              style={{ background: "var(--sab-paper-alt)", borderColor: "hsl(var(--border))" }}
            >
              <th className="sab-caps px-3 py-2 text-left">Description</th>
              <th className="sab-caps px-3 py-2 text-right">Qty</th>
              <th className="sab-caps px-3 py-2 text-right">Price</th>
              <th className="sab-caps px-3 py-2 text-right">GST%</th>
              <th className="sab-caps px-3 py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr
                key={l.id}
                className="border-b"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                  {l.description}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.quantity)} {l.unit}
                </td>
                <td className="px-3 py-2 text-right font-mono">{inr(l.unitPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "var(--sab-ink3)" }}>
                  {Number(l.gstRatePct)}%
                </td>
                <td
                  className="px-3 py-2 text-right font-mono font-semibold"
                  style={{ color: "var(--sab-ink)" }}
                >
                  {inr(l.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {bill.notes && (
        <section
          className="mt-5 rounded border p-4"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <div className="sab-caps mb-1" style={{ color: "var(--sab-ink3)" }}>
            Notes
          </div>
          <div className="whitespace-pre-wrap text-[13px]" style={{ color: "var(--sab-ink2)" }}>
            {bill.notes}
          </div>
        </section>
      )}
    </div>
  );
}
