import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { Role } from "@prisma/client";
import { Decimal } from "decimal.js";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { getProjectPnl, defaultRangeForProject } from "@/server/actions/pnl";
import { formatINR, sum, zero } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireSession();
  if (!hasRole(session, [Role.ADMIN, Role.MANAGER])) notFound();

  const { from: fromStr, to: toStr } = await searchParams;
  const from = fromStr ? new Date(fromStr) : new Date("2020-01-01T00:00:00Z");
  const to = toStr
    ? new Date(toStr)
    : new Date(Date.now() + 365 * 24 * 3600 * 1000);

  const projects = await db.project.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      status: true,
      contractValue: true,
      startDate: true,
      endDate: true,
      materialsSupplied: true,
    },
  });

  const rows = await Promise.all(
    projects.map(async (p) => {
      const effectiveRange =
        fromStr || toStr
          ? { from, to }
          : defaultRangeForProject(p.startDate, p.endDate);
      const pnl = await getProjectPnl(p.id, effectiveRange);
      // directMaterial already includes the project-level materialsSupplied override.
      return {
        project: p,
        pnl,
        material: pnl.directMaterial,
        contribution: pnl.contributionMargin,
        netPnl: pnl.netPnl,
      };
    }),
  );

  const totals = {
    contractValue: sum(projects.map((p) => p.contractValue)),
    revenue: rows.reduce<Decimal>((a, r) => a.plus(r.pnl.revenue), zero()),
    directLabor: rows.reduce<Decimal>((a, r) => a.plus(r.pnl.directLabor), zero()),
    directMaterial: rows.reduce<Decimal>((a, r) => a.plus(r.material), zero()),
    directOther: rows.reduce<Decimal>((a, r) => a.plus(r.pnl.directOther), zero()),
    contribution: rows.reduce<Decimal>((a, r) => a.plus(r.contribution), zero()),
    overhead: rows.reduce<Decimal>((a, r) => a.plus(r.pnl.overhead), zero()),
    netPnl: rows.reduce<Decimal>((a, r) => a.plus(r.netPnl), zero()),
  };

  const contribNeg = totals.contribution.lt(0);
  const netNeg = totals.netPnl.lt(0);

  return (
    <div>
      <PageHeader
        eyebrow="Executive"
        title="Portfolio P&L"
        description="One row per project. Leave dates blank to use each project's own start/end range."
        actions={
          <a
            href={`/api/export/portfolio${fromStr || toStr ? `?from=${fromStr ?? ""}&to=${toStr ?? ""}` : ""}`}
          >
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </Button>
          </a>
        }
      />

      <div className="mb-5">
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
              defaultValue={fromStr ?? ""}
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
              defaultValue={toStr ?? ""}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <Button type="submit" size="sm">
            Apply range
          </Button>
          <div className="ml-auto text-[11px] text-slate-500">
            Snapshot · {formatIST(new Date(), "dd-MM-yyyy HH:mm")} IST
          </div>
        </form>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total contract value"
          value={formatINR(totals.contractValue)}
          sub={`${projects.length} projects`}
        />
        <StatCard label="Invoiced revenue" value={formatINR(totals.revenue)} />
        <StatCard
          label="Contribution"
          value={formatINR(totals.contribution)}
          deltaDirection={contribNeg ? "down" : "up"}
        />
        <StatCard
          label="Net P&L"
          value={formatINR(totals.netPnl)}
          deltaDirection={netNeg ? "down" : "up"}
          delta={netNeg ? "Loss" : "Profit"}
          sub="After overhead"
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">Projects</div>
          <div className="text-[11px] text-slate-500">{rows.length} total</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Code</th>
                <th className="px-2 py-2.5">Name</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-2 py-2.5 text-right">Revenue</th>
                <th className="px-2 py-2.5 text-right">Labor</th>
                <th className="px-2 py-2.5 text-right">Material</th>
                <th className="px-2 py-2.5 text-right">Other</th>
                <th className="px-2 py-2.5 text-right">Contribution</th>
                <th className="px-2 py-2.5 text-right">Overhead</th>
                <th className="px-5 py-2.5 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-10 text-center text-[13px] text-slate-500"
                  >
                    No projects yet.
                  </td>
                </tr>
              )}
              {rows.map(({ project, pnl, material, contribution, netPnl }) => {
                const cmNeg = contribution.lt(0);
                const nNeg = netPnl.lt(0);
                return (
                  <tr
                    key={project.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/projects/${project.id}/pnl`}
                        className="font-mono text-[11px] font-medium text-brand hover:underline"
                      >
                        {project.code}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-slate-900">{project.name}</td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(pnl.revenue)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(pnl.directLabor)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(material)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(pnl.directOther)}
                    </td>
                    <td
                      className={
                        "px-2 py-2.5 text-right tabular-nums " +
                        (cmNeg ? "text-red-700" : "text-slate-900")
                      }
                    >
                      {formatINR(contribution)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      {formatINR(pnl.overhead)}
                    </td>
                    <td
                      className={
                        "px-5 py-2.5 text-right font-semibold tabular-nums " +
                        (nNeg ? "text-red-700" : "text-emerald-700")
                      }
                    >
                      {formatINR(netPnl)}
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="border-t-2 border-slate-300 bg-brand/5">
                  <td
                    colSpan={3}
                    className="px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-brand"
                  >
                    Total
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(totals.revenue)}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(totals.directLabor)}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(totals.directMaterial)}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(totals.directOther)}
                  </td>
                  <td
                    className={
                      "px-2 py-3 text-right font-semibold tabular-nums " +
                      (contribNeg ? "text-red-700" : "text-slate-900")
                    }
                  >
                    {formatINR(totals.contribution)}
                  </td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatINR(totals.overhead)}
                  </td>
                  <td
                    className={
                      "px-5 py-3 text-right font-semibold tabular-nums " +
                      (netNeg ? "text-red-700" : "text-emerald-700")
                    }
                  >
                    {formatINR(totals.netPnl)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
