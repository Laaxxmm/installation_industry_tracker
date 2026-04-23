import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { createGRN } from "@/server/actions/procurement";
import { PageHeader, Notice } from "@/components/sab";
import { GRNForm } from "../GRNForm";

export default async function NewGRNPage({
  searchParams,
}: {
  searchParams: Promise<{ poId?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const sp = await searchParams;

  // If a specific PO was passed via ?poId=... we load it directly.
  // Otherwise we list POs that are still open for receipt (SENT / PARTIALLY_RECEIVED / APPROVED).
  if (!sp.poId) {
    const candidates = await db.vendorPO.findMany({
      where: { status: { in: ["SENT", "APPROVED", "PARTIALLY_RECEIVED"] } },
      orderBy: { issueDate: "desc" },
      take: 50,
      include: {
        vendor: { select: { name: true, code: true } },
      },
    });
    return (
      <div>
        <PageHeader
          eyebrow="Procurement · New"
          title="Record goods receipt"
          description="Pick the purchase order you're receiving against."
        />
        {candidates.length === 0 ? (
          <Notice tone="alert">
            No purchase orders are open for receipt. Approve and send a PO first.
          </Notice>
        ) : (
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
                  <th className="sab-caps px-3 py-2 text-left">PO</th>
                  <th className="sab-caps px-3 py-2 text-left">Vendor</th>
                  <th className="sab-caps px-3 py-2 text-left">Status</th>
                  <th className="sab-caps px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--sab-accent-ink)" }}>
                      {po.poNo}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--sab-ink)" }}>
                      {po.vendor.name}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                      {po.status.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/procurement/grns/new?poId=${po.id}`}
                        className="inline-flex h-7 items-center rounded border px-3 text-[12px] font-medium"
                        style={{
                          borderColor: "hsl(var(--border))",
                          color: "var(--sab-accent-ink)",
                          background: "hsl(var(--card))",
                        }}
                      >
                        Receive
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const po = await db.vendorPO.findUnique({
    where: { id: sp.poId },
    include: {
      vendor: { select: { name: true, code: true, msme: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!po) notFound();

  async function handle(raw: unknown) {
    "use server";
    const grn = await createGRN(raw);
    redirect(`/procurement/grns/${grn.id}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Procurement · GRN against ${po.poNo}`}
        title={`Receive from ${po.vendor.name}`}
        description="Enter accepted + rejected quantities per line. Rejected lines should include a reason."
      />
      <GRNForm
        po={{
          id: po.id,
          poNo: po.poNo,
          vendor: po.vendor,
          lines: po.lines.map((l) => ({
            id: l.id,
            sku: l.sku,
            description: l.description,
            unit: l.unit,
            quantity: String(l.quantity),
            receivedQty: String(l.receivedQty),
          })),
        }}
        onSubmit={handle}
      />
    </div>
  );
}
