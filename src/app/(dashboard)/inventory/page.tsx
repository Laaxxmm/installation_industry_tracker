import Link from "next/link";
import { ArrowRightLeft, PackagePlus } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { formatINR, toDecimal } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { NewMaterialForm } from "./NewMaterialForm";
import { EditMaterialButton } from "./EditMaterialButton";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const active = sp.active?.trim() ?? "";

  const where = {
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(active === "true" ? { active: true } : active === "false" ? { active: false } : {}),
  };

  // Cap the table and compute portfolio-wide rollups with counts so big SKU
  // libraries (hundreds of rows) don't ship all rows to the client just to
  // read the three summary stats.
  const [materials, totalCount, activeSkus, lowStock, receiptSums, issueSums] =
    await Promise.all([
      db.material.findMany({
        where,
        orderBy: { sku: "asc" },
        take: 200,
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          openingQty: true,
          onHandQty: true,
          avgUnitCost: true,
          active: true,
        },
      }),
      db.material.count(),
      db.material.count({ where: { active: true } }),
      db.material.count({ where: { onHandQty: { lt: 10 } } }),
      db.stockReceipt.groupBy({
        by: ["materialId"],
        _sum: { qty: true },
      }),
      db.stockIssue.groupBy({
        by: ["materialId"],
        _sum: { qty: true },
      }),
    ]);
  const receiptByMat = new Map(
    receiptSums.map((r) => [r.materialId, toDecimal(r._sum.qty ?? 0)]),
  );
  const issueByMat = new Map(
    issueSums.map((r) => [r.materialId, toDecimal(r._sum.qty ?? 0)]),
  );
  const totalValue = materials.reduce(
    (sum, m) =>
      sum + toDecimal(m.onHandQty).times(toDecimal(m.avgUnitCost)).toNumber(),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Warehouse"
        title="Inventory"
        description={`${activeSkus} active SKUs · ${totalCount - activeSkus} archived`}
        actions={
          <>
            <Link href="/inventory/receipts">
              <Button variant="outline" size="sm">
                <PackagePlus className="h-3.5 w-3.5" /> Receipts
              </Button>
            </Link>
            <Link href="/inventory/issues">
              <Button size="sm">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Issues
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Shown SKU value"
          value={formatINR(totalValue)}
          sub={`First ${materials.length} SKUs · moving-avg`}
        />
        <StatCard
          label="Active SKUs"
          value={activeSkus}
          sub={`${totalCount} total`}
        />
        <StatCard
          label="Low stock"
          value={lowStock}
          deltaDirection={lowStock > 0 ? "down" : "up"}
          delta={lowStock > 0 ? "Review" : "All good"}
          sub="< 10 units on hand"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search SKU or name…"
          width={260}
        />
        <TableSelectFilter
          paramName="active"
          label="Status"
          current={active}
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Archived" },
          ]}
        />
        {(q || active) && (
          <span className="text-[11px] text-slate-500">
            {materials.length} SKU{materials.length === 1 ? "" : "s"} match
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>On-hand stock</CardTitle>
            <CardDescription>Moving-average cost per SKU</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">SKU</th>
                  <th className="px-2 py-2.5">Name</th>
                  <th className="px-2 py-2.5">Unit</th>
                  <th className="px-2 py-2.5 text-right">On hand</th>
                  <th className="px-2 py-2.5 text-right">Receipts</th>
                  <th className="px-2 py-2.5 text-right">Issues</th>
                  <th className="px-2 py-2.5 text-right">Total in hand</th>
                  <th className="px-2 py-2.5 text-right">Avg cost</th>
                  <th className="px-2 py-2.5 text-right">Value</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No materials yet.
                    </td>
                  </tr>
                )}
                {materials.map((m) => {
                  const receipts = receiptByMat.get(m.id) ?? toDecimal(0);
                  const issues = issueByMat.get(m.id) ?? toDecimal(0);
                  const opening = toDecimal(m.openingQty);
                  const totalInHand = opening.plus(receipts).minus(issues);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-2.5 font-mono text-[11px] font-medium text-brand">
                        {m.sku}
                      </td>
                      <td className="px-2 py-2.5 text-slate-900">{m.name}</td>
                      <td className="px-2 py-2.5 text-slate-600">{m.unit}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {opening.toString()}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700">
                        {receipts.toString()}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-red-700">
                        {issues.toString()}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {totalInHand.toString()}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {formatINR(m.avgUnitCost)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatINR(totalInHand.times(toDecimal(m.avgUnitCost)).toNumber())}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <EditMaterialButton
                          id={m.id}
                          sku={m.sku}
                          name={m.name}
                          unit={m.unit}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {materials.length >= 200 && totalCount > materials.length && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
                Showing 200 of {totalCount} materials.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New material</CardTitle>
            <CardDescription>Register a new SKU</CardDescription>
          </CardHeader>
          <CardContent>
            <NewMaterialForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
