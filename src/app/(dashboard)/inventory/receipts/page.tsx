import { Role } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReceiptForm } from "./ReceiptForm";
import { DeleteReceiptButton } from "./DeleteReceiptButton";
import { EditReceiptButton } from "./EditReceiptButton";

export default async function ReceiptsPage() {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const [receipts, materials] = await Promise.all([
    db.stockReceipt.findMany({
      orderBy: { receivedAt: "desc" },
      take: 100,
      select: {
        id: true,
        materialId: true,
        qty: true,
        unitCost: true,
        receivedAt: true,
        supplier: true,
        note: true,
        material: { select: { sku: true } },
      },
    }),
    db.material.findMany({
      where: { active: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
  ]);

  return (
    <div>
      <Link
        href="/inventory"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inventory
      </Link>
      <PageHeader
        eyebrow="Warehouse"
        title="Stock receipts"
        description="Goods received notes. Each receipt updates the SKU's moving-average cost."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 100 receipts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Received</th>
                  <th className="px-2 py-2.5">SKU</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Unit cost</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-2 py-2.5">Supplier</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No receipts yet.
                    </td>
                  </tr>
                )}
                {receipts.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(r.receivedAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] font-medium text-brand">
                      {r.material.sku}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {r.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(r.unitCost)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(Number(r.qty) * Number(r.unitCost))}
                    </td>
                    <td className="px-2 py-2.5 text-slate-600">
                      {r.supplier ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="inline-flex items-center">
                        <EditReceiptButton
                          receipt={{
                            id: r.id,
                            materialId: r.materialId,
                            qty: r.qty.toString(),
                            unitCost: r.unitCost.toString(),
                            supplier: r.supplier,
                            receivedAt: r.receivedAt.toISOString(),
                            note: r.note,
                          }}
                          materials={materials.map((m) => ({
                            id: m.id,
                            label: `${m.sku} — ${m.name}`,
                          }))}
                        />
                        <DeleteReceiptButton id={r.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New receipt</CardTitle>
            <CardDescription>
              Records qty, cost, and recomputes moving average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptForm
              materials={materials.map((m) => ({
                id: m.id,
                label: `${m.sku} — ${m.name}`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
