import Link from "next/link";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { PageHeader, KPI, Code, fmtDate } from "@/components/sab";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function GRNsPage() {
  await requireSession();

  const grns = await db.gRN.findMany({
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: {
      po: {
        select: {
          id: true,
          poNo: true,
          vendor: { select: { name: true, code: true } },
        },
      },
      receivedBy: { select: { name: true, email: true } },
      _count: { select: { lines: true } },
    },
  });

  const accepted = grns.filter((g) => g.status === "ACCEPTED").length;
  const partial = grns.filter((g) => g.status === "PARTIALLY_ACCEPTED").length;
  const rejected = grns.filter((g) => g.status === "REJECTED").length;

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const thisWeek = grns.filter((g) => g.receivedAt >= d7).length;

  return (
    <div>
      <PageHeader
        eyebrow="Procurement"
        title="Goods receipts"
        description={`${grns.length} GRNs · ${accepted} accepted · ${partial} partial · ${rejected} rejected`}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="GRNs recorded" value={grns.length} sub="across all vendors" />
        <KPI label="Accepted in full" value={accepted} sub="clean receipts" accent />
        <KPI label="Partially accepted" value={partial} sub="short/rejected qty" />
        <KPI label="This week" value={thisWeek} sub="last 7 days" />
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
              {["GRN", "PO", "Vendor", "Received", "By", "Lines", "Status"].map((h) => (
                <th
                  key={h}
                  className="sab-caps px-3 py-2.5 text-left"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grns.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px]"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  No goods receipts recorded yet.
                </td>
              </tr>
            )}
            {grns.map((g) => (
              <tr
                key={g.id}
                className="border-b transition-colors hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/procurement/grns/${g.id}`}
                    style={{ color: "var(--sab-accent-ink)" }}
                  >
                    <Code>{g.grnNo}</Code>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/procurement/purchase-orders/${g.poId}`}
                    style={{ color: "var(--sab-ink2)" }}
                  >
                    <Code>{g.po.poNo}</Code>
                  </Link>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink)" }}>
                  {g.po.vendor.name}
                  <div className="mt-0.5 sab-code" style={{ fontSize: 10, color: "var(--sab-ink3)" }}>
                    {g.po.vendor.code}
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {fmtDate(g.receivedAt)}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {g.receivedBy?.name ?? g.receivedBy?.email ?? "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--sab-ink2)" }}>
                  {g._count.lines}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={g.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
