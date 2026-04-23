import { notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import {
  approveVendorPO,
  sendVendorPO,
  cancelVendorPO,
} from "@/server/actions/procurement";
import { PageHeader, KPI, Pill, Code, inr, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";
import { POActions } from "./POActions";

export default async function VendorPODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canAct = hasRole(session, [Role.ADMIN, Role.MANAGER]);
  const { id } = await params;

  const po = await db.vendorPO.findUnique({
    where: { id },
    include: {
      vendor: true,
      project: { select: { id: true, code: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      grns: {
        orderBy: { receivedAt: "desc" },
        include: {
          receivedBy: { select: { name: true, email: true } },
          _count: { select: { lines: true } },
        },
      },
      bills: {
        orderBy: { issueDate: "desc" },
      },
      approvedBy: { select: { name: true, email: true } },
    },
  });
  if (!po) notFound();

  async function handleApprove() {
    "use server";
    await approveVendorPO(po!.id);
  }
  async function handleSend() {
    "use server";
    await sendVendorPO(po!.id);
  }
  async function handleCancel() {
    "use server";
    await cancelVendorPO(po!.id);
  }

  const receivedQty = po.lines.reduce((a, l) => a + Number(l.receivedQty), 0);
  const orderedQty = po.lines.reduce((a, l) => a + Number(l.quantity), 0);
  const pctReceived = orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0;

  return (
    <div>
      <div
        className="sab-caps mb-4 flex items-center gap-2"
        style={{ color: "var(--sab-ink3)" }}
      >
        <Link href="/procurement/purchase-orders">Purchase orders</Link>
        <span>·</span>
        <span style={{ color: "var(--sab-ink)" }}>{po.poNo}</span>
      </div>
      <PageHeader
        eyebrow={po.poNo}
        title={`PO to ${po.vendor.name}`}
        description={[
          `Issued ${fmtDate(po.issueDate)}`,
          po.expectedDate ? `Expected ${fmtDate(po.expectedDate)}` : null,
          po.project ? `Project ${po.project.code}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canAct ? (
            <POActions
              status={po.status}
              onApprove={handleApprove}
              onSend={handleSend}
              onCancel={handleCancel}
            />
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={po.status} />
        <Pill tone="ink" size="sm">
          {po.approvalTier === "auto"
            ? "Auto-approved"
            : po.approvalTier === "pm"
            ? "PM tier"
            : "Director tier"}
        </Pill>
        {po.vendor.msme && (
          <Pill tone="accent" size="sm" dot>
            MSME
          </Pill>
        )}
        {po.approvedBy && (
          <span className="text-[12px]" style={{ color: "var(--sab-ink3)" }}>
            Approved by {po.approvedBy.name ?? po.approvedBy.email}
            {po.approvedAt && ` on ${fmtDate(po.approvedAt)}`}
          </span>
        )}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <KPI label="Subtotal" value={inr(po.subtotal)} sub="before tax" />
        <KPI label="GST" value={inr(po.taxTotal)} sub={`${po.lines.length} lines`} />
        <KPI label="Grand total" value={inr(po.grandTotal)} accent />
        <KPI label="Received" value={`${pctReceived}%`} sub={`${po.grns.length} GRN(s)`} />
      </div>

      <section
        className="mb-5 rounded border"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div>
            <div className="sab-caps">Line items</div>
            <h2 className="mt-0.5 text-[15px] font-semibold">
              {po.lines.length} lines · {inr(po.grandTotal)} total
            </h2>
          </div>
          {canAct && (po.status === "SENT" || po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED") && (
            <Link
              href={`/procurement/grns/new?poId=${po.id}`}
              className="inline-flex h-7 items-center rounded border px-3 text-[12px] font-medium"
              style={{
                borderColor: "hsl(var(--border))",
                color: "var(--sab-accent-ink)",
                background: "hsl(var(--card))",
              }}
            >
              Record GRN
            </Link>
          )}
        </header>
        <table className="w-full text-[12.5px] sab-tabular">
          <thead>
            <tr
              className="border-b"
              style={{ background: "var(--sab-paper-alt)", borderColor: "hsl(var(--border))" }}
            >
              <th className="sab-caps px-3 py-2 text-left">SKU</th>
              <th className="sab-caps px-3 py-2 text-left">Description</th>
              <th className="sab-caps px-3 py-2 text-right">Ordered</th>
              <th className="sab-caps px-3 py-2 text-right">Received</th>
              <th className="sab-caps px-3 py-2 text-right">Price</th>
              <th className="sab-caps px-3 py-2 text-right">GST%</th>
              <th className="sab-caps px-3 py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const ordered = Number(l.quantity);
              const received = Number(l.receivedQty);
              const short = received < ordered;
              return (
                <tr
                  key={l.id}
                  className="border-b"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <td className="px-3 py-2">
                    <Code>{l.sku}</Code>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                    {l.description}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {ordered} {l.unit}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums"
                    style={{ color: short ? "var(--sab-amber)" : "var(--sab-positive)" }}
                  >
                    {received} {l.unit}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {inr(l.unitPrice)}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded border"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <header className="border-b px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="sab-caps">Goods receipts</div>
            <h2 className="mt-0.5 text-[15px] font-semibold">{po.grns.length} GRN(s)</h2>
          </header>
          <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
            {po.grns.length === 0 && (
              <div className="p-4 text-[12.5px]" style={{ color: "var(--sab-ink3)" }}>
                No GRNs recorded yet.
              </div>
            )}
            {po.grns.map((g) => (
              <Link
                key={g.id}
                href={`/procurement/grns/${g.id}`}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div>
                  <Code>{g.grnNo}</Code>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--sab-ink3)" }}>
                    {fmtDate(g.receivedAt)} · {g.receivedBy?.name ?? g.receivedBy?.email ?? "—"}
                  </div>
                </div>
                <StatusBadge status={g.status} />
              </Link>
            ))}
          </div>
        </section>

        <section
          className="rounded border"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <header className="border-b px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="sab-caps">Vendor bills</div>
            <h2 className="mt-0.5 text-[15px] font-semibold">{po.bills.length} on file</h2>
          </header>
          <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
            {po.bills.length === 0 && (
              <div className="p-4 text-[12.5px]" style={{ color: "var(--sab-ink3)" }}>
                No bills matched to this PO yet.
              </div>
            )}
            {po.bills.map((b) => (
              <Link
                key={b.id}
                href={`/procurement/vendor-bills/${b.id}`}
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="flex-1 truncate">
                  <Code>{b.billNo}</Code>
                  {b.vendorBillNo && (
                    <span className="ml-2 text-[11px]" style={{ color: "var(--sab-ink3)" }}>
                      vendor ref {b.vendorBillNo}
                    </span>
                  )}
                </div>
                <StatusBadge status={b.status} />
                <div
                  className="font-mono text-[12.5px] font-semibold"
                  style={{ color: "var(--sab-ink)" }}
                >
                  {inr(b.grandTotal)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {po.notes && (
        <section
          className="mt-5 rounded border p-4"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <div className="sab-caps mb-1" style={{ color: "var(--sab-ink3)" }}>
            Notes
          </div>
          <div className="whitespace-pre-wrap text-[13px]" style={{ color: "var(--sab-ink2)" }}>
            {po.notes}
          </div>
        </section>
      )}
    </div>
  );
}
