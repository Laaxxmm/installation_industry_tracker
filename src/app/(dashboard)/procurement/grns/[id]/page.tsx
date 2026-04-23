import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { PageHeader, KPI, Code, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function GRNDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const grn = await db.gRN.findUnique({
    where: { id },
    include: {
      po: {
        include: {
          vendor: { select: { id: true, code: true, name: true } },
        },
      },
      receivedBy: { select: { name: true, email: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          poLine: { select: { sku: true, description: true, unit: true, quantity: true } },
        },
      },
    },
  });
  if (!grn) notFound();

  const totalAccepted = grn.lines.reduce((a, l) => a + Number(l.acceptedQty), 0);
  const totalRejected = grn.lines.reduce((a, l) => a + Number(l.rejectedQty), 0);
  const totalOrdered = grn.lines.reduce((a, l) => a + Number(l.orderedQty), 0);

  return (
    <div>
      <div
        className="sab-caps mb-4 flex items-center gap-2"
        style={{ color: "var(--sab-ink3)" }}
      >
        <Link href="/procurement/grns">Goods receipts</Link>
        <span>·</span>
        <span style={{ color: "var(--sab-ink)" }}>{grn.grnNo}</span>
      </div>
      <PageHeader
        eyebrow={grn.grnNo}
        title={`Receipt from ${grn.po.vendor.name}`}
        description={[
          `Against ${grn.po.poNo}`,
          `Received ${fmtDate(grn.receivedAt)}`,
          grn.receivedBy ? `By ${grn.receivedBy.name ?? grn.receivedBy.email}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-5 flex items-center gap-2">
        <StatusBadge status={grn.status} />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KPI label="Ordered" value={`${totalOrdered}`} sub={`${grn.lines.length} lines`} />
        <KPI label="Accepted" value={`${totalAccepted}`} sub="taken into stock" accent />
        <KPI label="Rejected" value={`${totalRejected}`} sub="returned / damaged" />
      </div>

      <section
        className="rounded border"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <header className="border-b px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="sab-caps">Line receipts</div>
          <h2 className="mt-0.5 text-[15px] font-semibold">
            {grn.lines.length} lines recorded
          </h2>
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
              <th className="sab-caps px-3 py-2 text-right">Accepted</th>
              <th className="sab-caps px-3 py-2 text-right">Rejected</th>
              <th className="sab-caps px-3 py-2 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {grn.lines.map((l) => (
              <tr
                key={l.id}
                className="border-b"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2">
                  <Code>{l.poLine.sku}</Code>
                </td>
                <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                  {l.poLine.description}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.orderedQty)} {l.poLine.unit}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  style={{ color: "var(--sab-positive)" }}
                >
                  {Number(l.acceptedQty)}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  style={{ color: Number(l.rejectedQty) > 0 ? "var(--sab-alert)" : "var(--sab-ink3)" }}
                >
                  {Number(l.rejectedQty)}
                </td>
                <td className="px-3 py-2" style={{ color: "var(--sab-ink3)" }}>
                  {l.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {grn.notes && (
        <section
          className="mt-5 rounded border p-4"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <div className="sab-caps mb-1" style={{ color: "var(--sab-ink3)" }}>
            Notes
          </div>
          <div className="whitespace-pre-wrap text-[13px]" style={{ color: "var(--sab-ink2)" }}>
            {grn.notes}
          </div>
        </section>
      )}
    </div>
  );
}
