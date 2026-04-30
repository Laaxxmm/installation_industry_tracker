import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatINR, sum } from "@/lib/money";
import { ProjectTabs } from "../ProjectTabs";
import { BudgetLineForm } from "./BudgetLineForm";
import { DeleteBudgetLineButton } from "./DeleteBudgetLineButton";

const CATEGORY_VARIANT: Record<
  "MATERIAL" | "LABOR" | "OTHER",
  "info" | "brand" | "secondary"
> = {
  MATERIAL: "info",
  LABOR: "brand",
  OTHER: "secondary",
};

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const [project, materials] = await Promise.all([
    db.project.findUnique({
      where: { id },
      include: {
        budgetLines: {
          orderBy: [{ category: "asc" }, { createdAt: "asc" }],
          include: { material: { select: { sku: true } } },
        },
      },
    }),
    db.material.findMany({
      where: { active: true },
      select: { id: true, sku: true, name: true, unit: true, avgUnitCost: true },
      orderBy: { sku: "asc" },
      take: 2000,
    }),
  ]);
  if (!project) notFound();

  const canEdit = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  // Stat: how many MATERIAL budget lines are linked to a SKU? Shown so the
  // PM knows how much of their material budget is auto-approval-ready.
  const materialLines = project.budgetLines.filter((l) => l.category === "MATERIAL");
  const linkedMaterialLines = materialLines.filter((l) => l.materialId).length;

  const grouped = {
    MATERIAL: project.budgetLines.filter((l) => l.category === "MATERIAL"),
    LABOR: project.budgetLines.filter((l) => l.category === "LABOR"),
    OTHER: project.budgetLines.filter((l) => l.category === "OTHER"),
  };
  const totals = {
    MATERIAL: sum(grouped.MATERIAL.map((l) => l.total)),
    LABOR: sum(grouped.LABOR.map((l) => l.total)),
    OTHER: sum(grouped.OTHER.map((l) => l.total)),
  };
  const grandTotal = sum(Object.values(totals));

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-3">
            <span className="font-mono text-[11px] font-semibold text-brand">
              {project.code}
            </span>
            <StatusBadge status={project.status} />
          </span>
        }
        title="Budget"
        description={`${project.budgetLines.length} lines · Grand total ${formatINR(grandTotal)}`}
      />

      <ProjectTabs projectId={id} />

      <div className="mt-5 mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Material"
          value={formatINR(totals.MATERIAL)}
          sub={
            materialLines.length > 0
              ? `${linkedMaterialLines}/${materialLines.length} linked to SKU`
              : undefined
          }
        />
        <StatCard label="Labor" value={formatINR(totals.LABOR)} />
        <StatCard label="Other" value={formatINR(totals.OTHER)} />
        <StatCard label="Grand total" value={formatINR(grandTotal)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Category</th>
                <th className="px-2 py-2.5">Description</th>
                <th className="px-2 py-2.5 text-right">Qty</th>
                <th className="px-2 py-2.5 text-right">Unit cost</th>
                <th className="px-2 py-2.5 text-right">Total</th>
                {canEdit && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {project.budgetLines.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 6 : 5}
                    className="px-5 py-8 text-center text-[12px] text-slate-500"
                  >
                    No budget lines yet.
                  </td>
                </tr>
              )}
              {(["MATERIAL", "LABOR", "OTHER"] as const).map((cat) => (
                <Fragment key={cat}>
                  {grouped[cat].map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-slate-100 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-2.5">
                        <Badge variant={CATEGORY_VARIANT[cat]}>
                          {line.category}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-slate-800">
                        {line.description}
                        {line.material && (
                          <span
                            className="ml-2 inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700"
                            title="Linked to material — indents auto-approve up to budget qty"
                          >
                            🔗 {line.material.sku}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {line.quantity.toString()}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                        {formatINR(line.unitCost)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatINR(line.total)}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-2.5 text-right">
                          <DeleteBudgetLineButton lineId={line.id} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {grouped[cat].length > 0 && (
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <td
                        colSpan={4}
                        className="px-5 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-600"
                      >
                        Subtotal · {cat}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatINR(totals[cat])}
                      </td>
                      {canEdit && <td />}
                    </tr>
                  )}
                </Fragment>
              ))}
              {project.budgetLines.length > 0 && (
                <tr className="bg-brand/5">
                  <td
                    colSpan={4}
                    className="px-5 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wider text-brand"
                  >
                    Grand total
                  </td>
                  <td className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900">
                    {formatINR(grandTotal)}
                  </td>
                  {canEdit && <td />}
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Add budget line</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetLineForm
                projectId={id}
                materials={materials.map((m) => ({
                  id: m.id,
                  sku: m.sku,
                  name: m.name,
                  unit: m.unit,
                  avgUnitCost: m.avgUnitCost.toString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
