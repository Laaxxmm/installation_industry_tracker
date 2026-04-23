import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { formatINR, sum, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { ProjectTabs } from "../ProjectTabs";
import { DirectPurchaseForm } from "./DirectPurchaseForm";
import { TransferForm } from "./TransferForm";
import { EditPurchaseButton } from "./EditPurchaseButton";
import { EditTransferButton } from "./EditTransferButton";

export default async function ProjectMaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  // Split the single mega-query into scoped parallel queries with slim
  // selects. The previous version pulled full Material/User/Project rows into
  // every child record — hundreds of fields per row — and filtered by
  // siteSupervisor only after the big load. Checking existence + supervisor
  // first lets us fail fast and keep the heavy fetches independent.
  const projectMeta = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      siteSupervisorId: true,
    },
  });
  if (!projectMeta) notFound();
  if (
    session.user.role === Role.SUPERVISOR &&
    projectMeta.siteSupervisorId !== session.user.id
  ) {
    notFound();
  }

  const [stockIssues, directPurchases, budgetLines, transfersOut, transfersIn] =
    await Promise.all([
      db.stockIssue.findMany({
        where: { projectId: id },
        orderBy: { issuedAt: "desc" },
        take: 300,
        select: {
          id: true,
          qty: true,
          unitCostAtIssue: true,
          issuedAt: true,
          material: { select: { sku: true, unit: true } },
        },
      }),
      db.directPurchase.findMany({
        where: { projectId: id },
        orderBy: { purchasedAt: "desc" },
        take: 300,
      }),
      db.budgetLine.findMany({
        where: { projectId: id, category: "MATERIAL" },
      }),
      db.materialTransfer.findMany({
        where: { fromProjectId: id },
        orderBy: { transferredAt: "desc" },
        take: 200,
        select: {
          id: true,
          materialId: true,
          fromProjectId: true,
          toProjectId: true,
          qty: true,
          unitCostAtTransfer: true,
          transferredAt: true,
          note: true,
          material: { select: { sku: true } },
          toProject: { select: { code: true, name: true } },
        },
      }),
      db.materialTransfer.findMany({
        where: { toProjectId: id },
        orderBy: { transferredAt: "desc" },
        take: 200,
        select: {
          id: true,
          materialId: true,
          fromProjectId: true,
          toProjectId: true,
          qty: true,
          unitCostAtTransfer: true,
          transferredAt: true,
          note: true,
          material: { select: { sku: true } },
          fromProject: { select: { code: true, name: true } },
        },
      }),
    ]);

  const project = {
    ...projectMeta,
    stockIssues,
    directPurchases,
    budgetLines,
    transfersOut,
    transfersIn,
  };

  const canBook =
    hasRole(session, [Role.ADMIN, Role.MANAGER]) ||
    (session.user.role === Role.SUPERVISOR &&
      project.siteSupervisorId === session.user.id);

  const [otherProjects, materials] = canBook
    ? await Promise.all([
        db.project.findMany({
          where: {
            id: { not: id },
            status: { in: ["ACTIVE", "DRAFT", "ON_HOLD"] },
          },
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        }),
        db.material.findMany({
          where: { active: true },
          orderBy: { sku: "asc" },
          select: { id: true, sku: true, name: true },
        }),
      ])
    : [
        [] as { id: string; code: string; name: string }[],
        [] as { id: string; sku: string; name: string }[],
      ];

  const issueTotal = sum(
    project.stockIssues.map((i) =>
      toDecimal(i.qty).times(toDecimal(i.unitCostAtIssue)),
    ),
  );
  const purchaseTotal = sum(project.directPurchases.map((p) => p.total));
  const transfersInTotal = sum(
    project.transfersIn.map((t) =>
      toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer)),
    ),
  );
  const transfersOutTotal = sum(
    project.transfersOut.map((t) =>
      toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer)),
    ),
  );
  const actualMaterial = issueTotal
    .plus(purchaseTotal)
    .plus(transfersInTotal)
    .minus(transfersOutTotal);
  const budgetMaterial = sum(project.budgetLines.map((l) => l.total));
  const variance = budgetMaterial.minus(actualMaterial);
  const varianceNegative = variance.lt(0);

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
        title="Materials"
        description="Central stock issues, direct purchases, and inter-project transfers."
      />

      <ProjectTabs projectId={id} />

      <div className="mt-5 mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Budget" value={formatINR(budgetMaterial)} />
        <StatCard label="Stock issues" value={formatINR(issueTotal)} />
        <StatCard label="Direct purchases" value={formatINR(purchaseTotal)} />
        <StatCard label="Transfers in" value={formatINR(transfersInTotal)} />
        <StatCard label="Transfers out" value={"−" + formatINR(transfersOutTotal)} />
        <StatCard
          label="Variance"
          value={formatINR(variance)}
          deltaDirection={varianceNegative ? "down" : "up"}
          delta={varianceNegative ? "Over" : "Under"}
        />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Stock issues</CardTitle>
            <CardDescription>
              Materials issued from central warehouse, costed at moving-average.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-2 py-2.5">SKU</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Unit cost</th>
                  <th className="px-5 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {project.stockIssues.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No stock issues yet.
                    </td>
                  </tr>
                )}
                {project.stockIssues.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(i.issuedAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-slate-800">
                      {i.material.sku}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {i.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(i.unitCostAtIssue)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(Number(i.qty) * Number(i.unitCostAtIssue))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Direct-to-site purchases</CardTitle>
            <CardDescription>
              Booked directly against this project — no central-stock impact.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-2 py-2.5">Description</th>
                  <th className="px-2 py-2.5">Category</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Unit cost</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-2 py-2.5">Supplier</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {project.directPurchases.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No direct purchases yet.
                    </td>
                  </tr>
                )}
                {project.directPurchases.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(p.purchasedAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5 text-slate-800">{p.description}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant="secondary">{p.category}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {p.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(p.unitCost)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(p.total)}
                    </td>
                    <td className="px-2 py-2.5 text-slate-600">
                      {p.supplier ?? "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {canBook && (
                        <EditPurchaseButton
                          purchase={{
                            id: p.id,
                            projectId: p.projectId,
                            description: p.description,
                            qty: p.qty.toString(),
                            unitCost: p.unitCost.toString(),
                            supplier: p.supplier,
                            invoiceRef: p.invoiceRef,
                            purchasedAt: p.purchasedAt.toISOString(),
                            category: p.category as "MATERIAL" | "OTHER",
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inter-project transfers</CardTitle>
            <CardDescription>
              Material moved between sites without a round-trip through central stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-2 py-2.5">Direction</th>
                  <th className="px-2 py-2.5">Counterparty</th>
                  <th className="px-2 py-2.5">SKU</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Unit cost</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {project.transfersOut.length + project.transfersIn.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No transfers yet.
                    </td>
                  </tr>
                )}
                {project.transfersOut.map((t) => (
                  <tr
                    key={`out-${t.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(t.transferredAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="warning">Out</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-slate-800">
                      <span className="font-mono text-[11px] text-brand">
                        {t.toProject.code}
                      </span>{" "}
                      — {t.toProject.name}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-slate-800">
                      {t.material.sku}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {t.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(t.unitCostAtTransfer)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                      −
                      {formatINR(
                        Number(t.qty) * Number(t.unitCostAtTransfer),
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {canBook && (
                        <EditTransferButton
                          transfer={{
                            id: t.id,
                            materialId: t.materialId,
                            fromProjectId: t.fromProjectId,
                            toProjectId: t.toProjectId,
                            qty: t.qty.toString(),
                            transferredAt: t.transferredAt.toISOString(),
                            note: t.note,
                          }}
                          materials={materials.map((m) => ({
                            id: m.id,
                            label: `${m.sku} — ${m.name}`,
                          }))}
                          allProjects={[
                            { id: project.id, label: `${project.code} — ${project.name}` },
                            ...otherProjects.map((p) => ({
                              id: p.id,
                              label: `${p.code} — ${p.name}`,
                            })),
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {project.transfersIn.map((t) => (
                  <tr
                    key={`in-${t.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(t.transferredAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant="info">In</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-slate-800">
                      <span className="font-mono text-[11px] text-brand">
                        {t.fromProject.code}
                      </span>{" "}
                      — {t.fromProject.name}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-slate-800">
                      {t.material.sku}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {t.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(t.unitCostAtTransfer)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(
                        Number(t.qty) * Number(t.unitCostAtTransfer),
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {canBook && (
                        <EditTransferButton
                          transfer={{
                            id: t.id,
                            materialId: t.materialId,
                            fromProjectId: t.fromProjectId,
                            toProjectId: t.toProjectId,
                            qty: t.qty.toString(),
                            transferredAt: t.transferredAt.toISOString(),
                            note: t.note,
                          }}
                          materials={materials.map((m) => ({
                            id: m.id,
                            label: `${m.sku} — ${m.name}`,
                          }))}
                          allProjects={[
                            { id: project.id, label: `${project.code} — ${project.name}` },
                            ...otherProjects.map((p) => ({
                              id: p.id,
                              label: `${p.code} — ${p.name}`,
                            })),
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {canBook && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transfer to another project</CardTitle>
                <CardDescription>
                  Records cost out of this project and into the destination. No
                  central-stock impact.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TransferForm
                  fromProjectId={id}
                  materials={materials.map((m) => ({
                    id: m.id,
                    label: `${m.sku} — ${m.name}`,
                  }))}
                  otherProjects={otherProjects.map((p) => ({
                    id: p.id,
                    label: `${p.code} — ${p.name}`,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Book direct purchase</CardTitle>
                <CardDescription>
                  Materials or other costs paid directly against this project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DirectPurchaseForm projectId={id} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
