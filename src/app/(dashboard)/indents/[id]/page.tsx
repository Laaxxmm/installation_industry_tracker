import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialIndentStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { IndentActions } from "./IndentActions";
import { IssueLineButton } from "./IssueLineButton";

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

export default async function IndentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
  ]);
  const { id } = await params;

  const indent = await db.materialIndent.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, code: true, name: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
      lines: {
        orderBy: { id: "asc" },
        include: {
          material: {
            select: { id: true, sku: true, name: true, unit: true, onHandQty: true },
          },
        },
      },
    },
  });
  if (!indent) notFound();

  const role = session.user.role;
  const isOwnDraft =
    indent.requestedById === session.user.id &&
    indent.status === MaterialIndentStatus.DRAFT;

  // ADMIN can cancel anything non-terminal; the requester can cancel their
  // own DRAFT (createIndent only allows ADMIN/MANAGER, so isOwnDraft is
  // already gated to those two roles).
  const canCancel = role === Role.ADMIN || isOwnDraft;
  const canSubmit = isOwnDraft;
  const canApprove =
    role === Role.ADMIN &&
    indent.status === MaterialIndentStatus.PENDING_APPROVAL;
  const canIssue =
    (role === Role.ADMIN || role === Role.SUPERVISOR) &&
    (indent.status === MaterialIndentStatus.APPROVED ||
      indent.status === MaterialIndentStatus.PARTIALLY_ISSUED);

  const totalValue = indent.lines.reduce(
    (sum, l) =>
      sum +
      toDecimal(l.requestedQty)
        .times(toDecimal(l.unitCostSnapshot))
        .toNumber(),
    0,
  );
  const overBudgetCount = indent.lines.filter((l) => !l.isInBudget).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="font-mono text-[11px]">{indent.indentNo}</span>
        }
        title={`Indent for ${indent.project.code}`}
        description={
          <>
            <span>{indent.project.name}</span>
            <span className="mx-2 text-slate-400">·</span>
            <span>Requested by {indent.requestedBy.name}</span>
            {indent.submittedAt && (
              <>
                <span className="mx-2 text-slate-400">·</span>
                <span>
                  Submitted {formatIST(indent.submittedAt, "dd-MM-yyyy HH:mm")}
                </span>
              </>
            )}
          </>
        }
        actions={
          <IndentActions
            indentId={indent.id}
            indentNo={indent.indentNo}
            status={indent.status}
            canSubmit={canSubmit}
            canApprove={canApprove}
            canCancel={canCancel}
          />
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span
          className={
            "inline-flex items-center rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider " +
            STATUS_PILL[indent.status]
          }
        >
          {STATUS_LABELS[indent.status]}
        </span>
        {overBudgetCount > 0 && (
          <span className="text-[12px] text-amber-700">
            ⚠ {overBudgetCount} of {indent.lines.length} line{indent.lines.length === 1 ? "" : "s"} over budget
          </span>
        )}
        <span className="text-[12px] text-slate-600">
          Estimated value:{" "}
          <span className="font-semibold tabular-nums">{formatINR(totalValue)}</span>
        </span>
      </div>

      {indent.notes && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-[13px]">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-[13px] text-slate-700">
              {indent.notes}
            </div>
          </CardContent>
        </Card>
      )}

      {indent.status === MaterialIndentStatus.REJECTED && indent.rejectionReason && (
        <Card className="mb-5 border-red-200 bg-red-50/40">
          <CardHeader>
            <CardTitle className="text-[13px] text-red-800">
              Rejection reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[13px] text-red-800">
              {indent.rejectionReason}
            </div>
            {indent.approvedBy && indent.approvedAt && (
              <div className="mt-1 text-[11px] text-red-700">
                Rejected by {indent.approvedBy.name} ·{" "}
                {formatIST(indent.approvedAt, "dd-MM-yyyy HH:mm")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Material</th>
                <th className="px-2 py-2.5">Unit</th>
                <th className="px-2 py-2.5 text-right">Requested</th>
                <th className="px-2 py-2.5 text-right">Issued</th>
                <th className="px-2 py-2.5 text-right">On hand</th>
                <th className="px-2 py-2.5 text-right">Unit cost</th>
                <th className="px-2 py-2.5 text-right">Value</th>
                <th className="px-2 py-2.5">Budget</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {indent.lines.map((line) => {
                const requested = toDecimal(line.requestedQty);
                const issued = toDecimal(line.issuedQty);
                const remaining = requested.minus(issued);
                const lineValue = requested
                  .times(toDecimal(line.unitCostSnapshot))
                  .toNumber();
                const fullyIssued = remaining.lte(0);
                return (
                  <tr
                    key={line.id}
                    className="border-b border-slate-100 last:border-0 align-top"
                  >
                    <td className="px-5 py-3">
                      <div className="font-mono text-[11px] text-slate-600">
                        {line.material.sku}
                      </div>
                      <div className="text-slate-900">{line.material.name}</div>
                      {line.notes && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {line.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-600">{line.material.unit}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                      {requested.toString()}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-emerald-700">
                      {issued.toString()}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                      {line.material.onHandQty.toString()}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                      {formatINR(line.unitCostSnapshot)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                      {formatINR(lineValue)}
                    </td>
                    <td className="px-2 py-3">
                      {line.isInBudget ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          In budget
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-amber-700"
                          title={line.reasonOutOfBudget ?? ""}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Over budget
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canIssue && !fullyIssued && (
                        <IssueLineButton
                          lineId={line.id}
                          maxQty={remaining.toString()}
                          onHandQty={line.material.onHandQty.toString()}
                          materialName={line.material.name}
                          unit={line.material.unit}
                        />
                      )}
                      {fullyIssued && (
                        <span className="text-[11px] font-medium text-emerald-700">
                          Done
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 text-[12px] font-semibold">
                <td className="px-5 py-3" colSpan={6}>
                  Total
                </td>
                <td className="px-2 py-3 text-right tabular-nums">
                  {formatINR(totalValue)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {indent.lines.some((l) => !l.isInBudget && l.reasonOutOfBudget) && (
        <Card className="mt-5 border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-[13px] text-amber-900">
              Why approval is needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-[13px] text-amber-900">
              {indent.lines
                .filter((l) => !l.isInBudget && l.reasonOutOfBudget)
                .map((l) => (
                  <li key={l.id}>
                    <span className="font-mono text-[11px]">{l.material.sku}</span>:{" "}
                    {l.reasonOutOfBudget}
                  </li>
                ))}
            </ul>
            {indent.status === MaterialIndentStatus.PENDING_APPROVAL && (
              <div className="mt-3 text-[12px] text-amber-800">
                Tip: Linking these materials in the project budget at{" "}
                <Link
                  href={`/projects/${indent.project.id}/budget`}
                  className="underline"
                >
                  /projects/{indent.project.code}/budget
                </Link>{" "}
                will let future indents auto-approve.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
