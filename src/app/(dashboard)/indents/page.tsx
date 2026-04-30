import Link from "next/link";
import { Plus } from "lucide-react";
import { MaterialIndentStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatINR, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const STATUS_LABELS: Record<MaterialIndentStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIALLY_ISSUED: "Partially issued",
  ISSUED: "Issued",
  CANCELLED: "Cancelled",
};

const STATUS_PILL: Record<MaterialIndentStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  PARTIALLY_ISSUED: "bg-sky-50 text-sky-700 border-sky-200",
  ISSUED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

const TABLE_CAP = 200;

export default async function IndentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; projectId?: string }>;
}) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
  ]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";
  const projectId = sp.projectId?.trim() ?? "";

  // Role-aware default scope:
  //  - SUPERVISOR (storekeeper) only sees indents that are ready or partially
  //    issued (their work queue) when no status filter is active.
  //  - ADMIN / MANAGER see everything.
  const role = session.user.role;
  const supervisorDefaultScope: Prisma.MaterialIndentWhereInput =
    role === Role.SUPERVISOR && !status
      ? {
          status: {
            in: [
              MaterialIndentStatus.APPROVED,
              MaterialIndentStatus.PARTIALLY_ISSUED,
            ],
          },
        }
      : {};

  const where: Prisma.MaterialIndentWhereInput = {
    ...supervisorDefaultScope,
    ...(q
      ? {
          OR: [
            { indentNo: { contains: q, mode: "insensitive" } },
            { project: { code: { contains: q, mode: "insensitive" } } },
            { project: { name: { contains: q, mode: "insensitive" } } },
            { requestedBy: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(status ? { status: status as MaterialIndentStatus } : {}),
    ...(projectId ? { projectId } : {}),
  };

  const [indents, totalCount, statusGroups] = await Promise.all([
    db.materialIndent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: TABLE_CAP,
      include: {
        project: { select: { code: true, name: true } },
        requestedBy: { select: { name: true } },
        lines: {
          select: {
            requestedQty: true,
            issuedQty: true,
            unitCostSnapshot: true,
            isInBudget: true,
          },
        },
      },
    }),
    db.materialIndent.count(),
    db.materialIndent.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countOf = (s: MaterialIndentStatus) =>
    statusGroups.find((g) => g.status === s)?._count._all ?? 0;

  const draftCount = countOf(MaterialIndentStatus.DRAFT);
  const pendingApprovalCount = countOf(MaterialIndentStatus.PENDING_APPROVAL);
  const readyToIssueCount =
    countOf(MaterialIndentStatus.APPROVED) +
    countOf(MaterialIndentStatus.PARTIALLY_ISSUED);
  const issuedCount = countOf(MaterialIndentStatus.ISSUED);

  const canCreate = role === Role.ADMIN || role === Role.MANAGER;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Material indents"
        description={`${totalCount} total · ${draftCount} draft · ${pendingApprovalCount} awaiting approval · ${readyToIssueCount} ready to issue`}
        actions={
          canCreate ? (
            <Link href="/indents/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New indent
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Awaiting approval"
          value={pendingApprovalCount}
          deltaDirection={pendingApprovalCount > 0 ? "down" : "up"}
          delta={pendingApprovalCount > 0 ? "ADMIN action" : "All clear"}
          sub="Over-budget items"
        />
        <StatCard label="Ready to issue" value={readyToIssueCount} sub="Approved + partial" />
        <StatCard label="Drafts" value={draftCount} sub="Not yet submitted" />
        <StatCard label="Fully issued" value={issuedCount} sub="Closed" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search indent no, project, or requester…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status || projectId) && (
          <span className="text-[11px] text-slate-500">
            {indents.length} of {totalCount} indent{totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Indent #</th>
              <th className="px-2 py-2.5">Project</th>
              <th className="px-2 py-2.5">Requested by</th>
              <th className="px-2 py-2.5 text-right">Lines</th>
              <th className="px-2 py-2.5 text-right">Value</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-5 py-2.5">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {indents.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  No indents yet.{" "}
                  {canCreate && (
                    <Link href="/indents/new" className="text-brand hover:underline">
                      Raise the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {indents.map((ind) => {
              const value = ind.lines.reduce(
                (sum, l) =>
                  sum +
                  toDecimal(l.requestedQty)
                    .times(toDecimal(l.unitCostSnapshot))
                    .toNumber(),
                0,
              );
              const overBudgetLines = ind.lines.filter((l) => !l.isInBudget).length;
              return (
                <tr
                  key={ind.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/indents/${ind.id}`}
                      className="font-mono text-[11px] font-medium text-brand hover:underline"
                    >
                      {ind.indentNo}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-slate-900">
                    <span className="font-mono text-[11px] text-slate-600">
                      {ind.project.code}
                    </span>{" "}
                    {ind.project.name}
                  </td>
                  <td className="px-2 py-3 text-slate-700">
                    {ind.requestedBy.name}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {ind.lines.length}
                    {overBudgetLines > 0 && (
                      <span
                        className="ml-1 text-[10px] text-amber-700"
                        title={`${overBudgetLines} line(s) over budget`}
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                    {formatINR(value)}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                        STATUS_PILL[ind.status]
                      }
                    >
                      {STATUS_LABELS[ind.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[11px] text-slate-600">
                    {ind.submittedAt
                      ? formatIST(ind.submittedAt, "dd-MM-yyyy")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {indents.length >= TABLE_CAP && totalCount > indents.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing {TABLE_CAP} of {totalCount} indents. Refine search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
