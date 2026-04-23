import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { PageHeader, KPI, Pill, Code, inr, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
  PENDING_MATCH: "Pending match",
  MATCHED: "Matched",
  DISCREPANCY: "Discrepancy",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const vendor = await db.vendor.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        orderBy: { issueDate: "desc" },
        take: 30,
        include: { project: { select: { code: true, name: true } } },
      },
      bills: {
        orderBy: { issueDate: "desc" },
        take: 10,
      },
    },
  });
  if (!vendor) notFound();

  const totalSpend = vendor.purchaseOrders.reduce(
    (a, p) => a + Number(p.grandTotal),
    0,
  );
  const outstanding = vendor.bills
    .filter((b) => b.status !== "PAID" && b.status !== "DRAFT")
    .reduce((a, b) => a + Number(b.grandTotal) - Number(b.amountPaid), 0);

  return (
    <div>
      <div
        className="sab-caps mb-4 flex items-center gap-2"
        style={{ color: "var(--sab-ink3)" }}
      >
        <Link href="/procurement/vendors">Vendors</Link>
        <span>·</span>
        <span style={{ color: "var(--sab-ink)" }}>{vendor.code}</span>
      </div>
      <PageHeader
        eyebrow={vendor.code}
        title={vendor.name}
        description={[
          vendor.contactName,
          vendor.phone,
          vendor.email,
          vendor.stateCode,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-5 flex items-center gap-2">
        {vendor.msme && (
          <Pill tone="accent" dot>
            MSME
          </Pill>
        )}
        <Pill tone="ink" size="sm">
          {vendor.category}
        </Pill>
        <Pill tone="ink" size="sm">
          {vendor.paymentTerms.replace("_", " ")}
        </Pill>
        {vendor.gstin && (
          <Code style={{ fontSize: 12 }}>{vendor.gstin}</Code>
        )}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <KPI label="Credit limit" value={inr(vendor.creditLimit)} sub={vendor.paymentTerms.replace("_", " ")} />
        <KPI label="Outstanding" value={inr(outstanding)} sub={`${vendor.bills.length} bills on file`} accent />
        <KPI label="Total spend" value={inr(totalSpend)} sub={`${vendor.purchaseOrders.length} POs`} />
        <KPI
          label="Closed POs"
          value={vendor.purchaseOrders.filter((p) => p.status === "RECEIVED" || p.status === "CLOSED").length}
          sub="fully received"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section
          className="rounded border lg:col-span-2"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div>
              <div className="sab-caps">Purchase orders</div>
              <h2 className="mt-0.5 text-[15px] font-semibold">
                {vendor.purchaseOrders.length} orders
              </h2>
            </div>
          </header>
          {vendor.purchaseOrders.length === 0 ? (
            <div className="p-6 text-[13px]" style={{ color: "var(--sab-ink3)" }}>
              No POs raised against this vendor yet.
            </div>
          ) : (
            <table className="w-full text-[12.5px] sab-tabular">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    background: "var(--sab-paper-alt)",
                    borderColor: "hsl(var(--border))",
                  }}
                >
                  <th className="sab-caps px-3 py-2 text-left">PO</th>
                  <th className="sab-caps px-3 py-2 text-left">Project</th>
                  <th className="sab-caps px-3 py-2 text-left">Issued</th>
                  <th className="sab-caps px-3 py-2 text-left">Status</th>
                  <th className="sab-caps px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {vendor.purchaseOrders.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/procurement/purchase-orders/${po.id}`}
                        style={{ color: "var(--sab-accent-ink)" }}
                      >
                        <Code>{po.poNo}</Code>
                      </Link>
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                      {po.project ? `${po.project.code} · ${po.project.name}` : "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                      {fmtDate(po.issueDate)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={po.status} />
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono font-semibold"
                      style={{ color: "var(--sab-ink)" }}
                    >
                      {inr(po.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          className="rounded border"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <header
            className="border-b px-4 py-3"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="sab-caps">Recent bills</div>
            <h2 className="mt-0.5 text-[15px] font-semibold">
              {vendor.bills.length} on file
            </h2>
          </header>
          <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
            {vendor.bills.length === 0 && (
              <div className="p-4 text-[12.5px]" style={{ color: "var(--sab-ink3)" }}>
                No bills yet.
              </div>
            )}
            {vendor.bills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <Link
                  href={`/procurement/vendor-bills/${b.id}`}
                  className="flex-1 truncate"
                >
                  <Code>{b.billNo}</Code>
                </Link>
                <div className="text-[11px]" style={{ color: "var(--sab-ink3)" }}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </div>
                <div
                  className="font-mono text-[12.5px] font-semibold"
                  style={{ color: "var(--sab-ink)" }}
                >
                  {inr(b.grandTotal)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
