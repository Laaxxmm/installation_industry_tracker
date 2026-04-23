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
import { IssueForm } from "./IssueForm";
import { DeleteIssueButton } from "./DeleteIssueButton";
import { EditIssueButton } from "./EditIssueButton";

export default async function IssuesPage() {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);

  const projectWhere =
    session.user.role === Role.SUPERVISOR
      ? { siteSupervisorId: session.user.id }
      : {};

  const [issues, materials, projects] = await Promise.all([
    db.stockIssue.findMany({
      orderBy: { issuedAt: "desc" },
      take: 100,
      select: {
        id: true,
        materialId: true,
        projectId: true,
        qty: true,
        unitCostAtIssue: true,
        issuedAt: true,
        note: true,
        material: { select: { sku: true } },
        project: { select: { code: true } },
        issuedBy: { select: { name: true } },
      },
    }),
    db.material.findMany({
      where: { active: true },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, onHandQty: true },
    }),
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT"] }, ...projectWhere },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
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
        title="Stock issues"
        description="Materials issued from central stock to projects at current moving-average cost."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 100 issues</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Issued</th>
                  <th className="px-2 py-2.5">SKU</th>
                  <th className="px-2 py-2.5">Project</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Cost</th>
                  <th className="px-2 py-2.5">By</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {issues.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No issues yet.
                    </td>
                  </tr>
                )}
                {issues.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                      {formatIST(i.issuedAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] font-medium text-slate-800">
                      {i.material.sku}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] font-medium text-brand">
                      {i.project.code}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {i.qty.toString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(Number(i.qty) * Number(i.unitCostAtIssue))}
                    </td>
                    <td className="px-2 py-2.5 text-slate-600">
                      {i.issuedBy.name}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="inline-flex items-center">
                        <EditIssueButton
                          issue={{
                            id: i.id,
                            materialId: i.materialId,
                            projectId: i.projectId,
                            qty: i.qty.toString(),
                            issuedAt: i.issuedAt.toISOString(),
                            note: i.note,
                          }}
                          materials={materials.map((m) => ({
                            id: m.id,
                            label: `${m.sku} — ${m.name}`,
                          }))}
                          projects={projects}
                        />
                        <DeleteIssueButton id={i.id} />
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
            <CardTitle>New issue</CardTitle>
            <CardDescription>
              Snapshots moving-average cost at time of issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IssueForm
              materials={materials.map((m) => ({
                id: m.id,
                label: `${m.sku} — ${m.name}`,
                onHand: m.onHandQty.toString(),
              }))}
              projects={projects}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
