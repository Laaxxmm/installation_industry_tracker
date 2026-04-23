import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { getProjectPnl, defaultRangeForProject } from "@/server/actions/pnl";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProjectTabs } from "../ProjectTabs";

export default async function ProjectPnlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from: fromStr, to: toStr } = await searchParams;
  const session = await requireSession();

  if (!hasRole(session, [Role.ADMIN, Role.MANAGER])) {
    notFound();
  }

  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();

  const defaultRange = defaultRangeForProject(project.startDate, project.endDate);
  const range = {
    from: fromStr ? new Date(fromStr) : defaultRange.from,
    to: toStr ? new Date(toStr) : defaultRange.to,
  };

  const pnl = await getProjectPnl(id, range);

  const directTotal = pnl.directLabor.plus(pnl.directMaterial).plus(pnl.directOther);
  const cmNegative = pnl.contributionMargin.lt(0);
  const netNegative = pnl.netPnl.lt(0);
  const revenueNum = Number(pnl.revenue.toString());
  const cmPct = revenueNum > 0
    ? Number(pnl.contributionMargin.toString()) / revenueNum * 100
    : 0;

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
        title="Profit & Loss"
        description={`${formatIST(range.from, "dd MMM yyyy")}  →  ${formatIST(range.to, "dd MMM yyyy")}`}
        actions={
          <a
            href={`/api/export/project-pnl?projectId=${id}&from=${formatIST(range.from, "yyyy-MM-dd")}&to=${formatIST(range.to, "yyyy-MM-dd")}`}
          >
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </Button>
          </a>
        }
      />

      <ProjectTabs projectId={id} />

      <div className="mt-5 mb-5">
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-card"
        >
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              From
            </label>
            <input
              type="date"
              name="from"
              defaultValue={formatIST(range.from, "yyyy-MM-dd")}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              To
            </label>
            <input
              type="date"
              name="to"
              defaultValue={formatIST(range.to, "yyyy-MM-dd")}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <Button type="submit" size="sm">
            Apply range
          </Button>
        </form>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatINR(pnl.revenue)} sub="Invoiced in range" />
        <StatCard
          label="Direct costs"
          value={formatINR(directTotal)}
          sub="Labor · material · other"
        />
        <StatCard
          label="Contribution margin"
          value={formatINR(pnl.contributionMargin)}
          deltaDirection={cmNegative ? "down" : "up"}
          delta={revenueNum > 0 ? `${cmPct.toFixed(1)}%` : "—"}
          sub="Revenue − direct"
        />
        <StatCard
          label="Net P&L"
          value={formatINR(pnl.netPnl)}
          deltaDirection={netNegative ? "down" : "up"}
          delta={netNegative ? "Loss" : "Profit"}
          sub="After overhead"
        />
      </div>

      {/* Breakdown */}
      <div className="mb-5 rounded-md border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">P&L breakdown</div>
          <div className="text-[11px] text-slate-500">
            Computed on demand from source entries in the selected range.
          </div>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            <PnlRow label="Revenue (invoices)" value={formatINR(pnl.revenue)} bold />
            <PnlSub label="Direct labor — hourly" value={formatINR(pnl.directLaborHourly)} />
            <PnlSub label="Direct labor — salaried (allocated)" value={formatINR(pnl.directLaborSalaried)} />
            <PnlRow label="Direct labor total" value={formatINR(pnl.directLabor)} bold />
            <PnlSub
              label="Direct materials"
              value={formatINR(pnl.directMaterial.minus(pnl.materialOverride ?? 0))}
            />
            <PnlSub
              label="Direct other"
              value={formatINR(pnl.materialOverride ?? 0)}
            />
            <PnlRow label="Direct material total" value={formatINR(pnl.directMaterial)} bold />
            <PnlRow label="Other direct costs" value={formatINR(pnl.directOther)} />
            <PnlRow
              label="Contribution margin"
              value={formatINR(pnl.contributionMargin)}
              emphasis
              negative={cmNegative}
            />
            <PnlRow label="Overhead allocated" value={formatINR(pnl.overhead)} />
            <PnlRow
              label="Net P&L"
              value={formatINR(pnl.netPnl)}
              emphasis
              negative={netNegative}
            />
          </tbody>
        </table>
      </div>

      {/* Variance */}
      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">
            Budget vs actual
          </div>
          <div className="text-[11px] text-slate-500">
            Positive variance = under budget. Negative = over budget.
          </div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Category</th>
              <th className="px-2 py-2.5 text-right">Budget</th>
              <th className="px-2 py-2.5 text-right">Actual</th>
              <th className="px-2 py-2.5 text-right">Variance</th>
              <th className="px-5 py-2.5 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {(["material", "labor", "other"] as const).map((cat) => {
              const v = pnl.variance[cat];
              const over = v.variance.lt(0);
              return (
                <tr
                  key={cat}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3 font-medium capitalize text-slate-900">
                    {cat}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {formatINR(v.budget)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-700">
                    {formatINR(v.actual)}
                  </td>
                  <td
                    className={
                      "px-2 py-3 text-right tabular-nums font-semibold " +
                      (over ? "text-red-700" : "text-emerald-700")
                    }
                  >
                    {formatINR(v.variance)}
                  </td>
                  <td
                    className={
                      "px-5 py-3 text-right tabular-nums " +
                      (over ? "text-red-700" : "text-emerald-700")
                    }
                  >
                    {v.variancePct ? `${v.variancePct.toString()}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PnlRow({
  label,
  value,
  bold,
  emphasis,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <tr
      className={
        "border-b border-slate-100 last:border-0 " +
        (emphasis ? "bg-slate-50" : "")
      }
    >
      <td
        className={
          "px-5 py-2.5 " +
          (emphasis
            ? "text-[13px] font-semibold text-slate-900"
            : bold
              ? "font-medium text-slate-900"
              : "text-slate-800")
        }
      >
        {label}
      </td>
      <td
        className={
          "px-5 py-2.5 text-right tabular-nums " +
          (emphasis
            ? "text-[13px] font-semibold " +
              (negative ? "text-red-700" : "text-emerald-700")
            : bold
              ? "font-semibold text-slate-900"
              : "text-slate-700")
        }
      >
        {value}
      </td>
    </tr>
  );
}

function PnlSub({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pl-10 pr-5 text-[12px] text-slate-600">{label}</td>
      <td className="px-5 py-2 text-right tabular-nums text-[12px] text-slate-600">
        {value}
      </td>
    </tr>
  );
}
