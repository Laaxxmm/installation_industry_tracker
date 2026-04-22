import Link from "next/link";
import { ArrowUpRight, Download, Plus } from "lucide-react";
import { Decimal } from "decimal.js";
import { InvoiceStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { getProjectPnl } from "@/server/actions/pnl";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardFyFilter } from "./DashboardFyFilter";
import { DashboardDescriptionFilter } from "./DashboardDescriptionFilter";
import { toDecimal, formatINRCompact, formatINR, zero } from "@/lib/money";
import { istFyStart, istFyEnd, istFyLabel } from "@/lib/time";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string; description?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const now = new Date();
  const currentFyYear = istFyStart(now).getUTCFullYear();

  const fyYearRaw = sp.fy ? Number(sp.fy) : NaN;
  const fyYear = Number.isFinite(fyYearRaw) ? fyYearRaw : null;
  const selectedDescription = sp.description ?? "";

  const scopeRange = fyYear
    ? {
        from: istFyStart(new Date(fyYear, 5, 1)),
        to: istFyEnd(new Date(fyYear, 5, 1)),
      }
    : null;
  const scopeLabel = fyYear
    ? istFyLabel(new Date(fyYear, 5, 1))
    : "All-time";

  const issuedAtFilter = scopeRange
    ? { issuedAt: { gte: scopeRange.from, lt: scopeRange.to } }
    : {};

  const descriptionProjectFilter = selectedDescription
    ? { description: selectedDescription }
    : {};
  const descriptionRelationFilter = selectedDescription
    ? { project: { description: selectedDescription } }
    : {};

  const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    projects,
    descriptionOptionsRaw,
    billedByProjectAgg,
    scopedBilledAgg,
    allTimeBilledAgg,
    receivablesAgg,
    awaitingPaymentCount,
    workStatusGroups,
    trendInvoices,
    openTimesheets,
    materialsCount,
    oldestInvoiceAgg,
    oldestPoAgg,
  ] = await Promise.all([
    db.project.findMany({
      where: descriptionProjectFilter,
      select: {
        id: true,
        clientName: true,
        contractValue: true,
        adjBillableValue: true,
        poDate: true,
        response: true,
        materialsSupplied: true,
      },
    }),
    db.project.findMany({
      where: { description: { not: null } },
      select: { description: true },
      distinct: ["description"],
      orderBy: { description: "asc" },
    }),
    db.clientInvoice.groupBy({
      by: ["projectId"],
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        ...issuedAtFilter,
        ...descriptionRelationFilter,
      },
      _sum: { grandTotal: true },
    }),
    db.clientInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        ...issuedAtFilter,
        ...descriptionRelationFilter,
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    db.clientInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        ...descriptionRelationFilter,
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    db.clientInvoice.aggregate({
      where: {
        status: InvoiceStatus.ISSUED,
        ...issuedAtFilter,
        ...descriptionRelationFilter,
      },
      _sum: { grandTotal: true, amountPaid: true },
    }),
    db.clientInvoice.count({
      where: {
        status: InvoiceStatus.ISSUED,
        ...issuedAtFilter,
        ...descriptionRelationFilter,
      },
    }),
    db.project.groupBy({
      by: ["workStatus"],
      where: descriptionProjectFilter,
      _count: { _all: true },
    }),
    db.clientInvoice.findMany({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        issuedAt: { gte: trendStart },
        ...descriptionRelationFilter,
      },
      select: { grandTotal: true, issuedAt: true },
    }),
    db.timeEntry.count({
      where: { status: "OPEN", ...descriptionRelationFilter },
    }),
    db.material.count({ where: { active: true } }),
    db.clientInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        issuedAt: { not: null },
      },
      _min: { issuedAt: true },
    }),
    db.project.aggregate({
      where: { poDate: { not: null } },
      _min: { poDate: true },
    }),
  ]);

  const descriptionOptions = descriptionOptionsRaw
    .map((d) => d.description?.trim() ?? "")
    .filter((d) => d.length > 0);

  const billedByProject = new Map<string, Decimal>(
    billedByProjectAgg.map((b) => [
      b.projectId,
      toDecimal(b._sum.grandTotal ?? 0),
    ]),
  );

  // Portfolio-wide stats (always all-time) for the panels that aren't scoped.
  let noPoDateCount = 0;
  let noResponseCount = 0;
  const clientSet = new Set<string>();
  const clientTotals = new Map<string, Decimal>();
  for (const p of projects) {
    const po = toDecimal(p.contractValue);
    if (!p.poDate) noPoDateCount++;
    if (!p.response || !p.response.trim()) noResponseCount++;
    if (p.clientName) {
      clientSet.add(p.clientName);
      clientTotals.set(
        p.clientName,
        (clientTotals.get(p.clientName) ?? new Decimal(0)).plus(po),
      );
    }
  }
  const topClients = [...clientTotals.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]))
    .slice(0, 5);

  // Scope-aware project slice: projects whose poDate falls in the selected
  // FY (or all projects when no FY filter is active).
  const projectsInScope = scopeRange
    ? projects.filter(
        (p) =>
          p.poDate !== null &&
          p.poDate >= scopeRange.from &&
          p.poDate < scopeRange.to,
      )
    : projects;

  let poTotal = new Decimal(0);
  let outstandingBillable = new Decimal(0);
  let needBillCount = 0;
  for (const p of projectsInScope) {
    const po = toDecimal(p.contractValue);
    const billed = billedByProject.get(p.id) ?? new Decimal(0);
    const adj = toDecimal(p.adjBillableValue);
    const billable = po.minus(billed).minus(adj);
    poTotal = poTotal.plus(po);
    if (billable.greaterThan(0)) {
      outstandingBillable = outstandingBillable.plus(billable);
      needBillCount++;
    }
  }

  const oldestInvoiceAt = oldestInvoiceAgg._min.issuedAt ?? null;
  const oldestPoAt = oldestPoAgg._min.poDate ?? null;
  let oldestFyYear = currentFyYear;
  if (oldestPoAt) {
    const y = istFyStart(oldestPoAt).getUTCFullYear();
    if (y < oldestFyYear) oldestFyYear = y;
  }
  if (oldestInvoiceAt) {
    const y = istFyStart(oldestInvoiceAt).getUTCFullYear();
    if (y < oldestFyYear) oldestFyYear = y;
  }
  const fyYears: number[] = [];
  for (let y = currentFyYear; y >= oldestFyYear; y--) fyYears.push(y);

  const pnlRange = scopeRange ?? {
    from: new Date("2000-01-01"),
    to: new Date("2099-12-31"),
  };
  const pnlRows = await Promise.all(
    projectsInScope.map(async (p) => {
      const pnlRow = await getProjectPnl(p.id, pnlRange);
      // directMaterial already includes the project-level materialsSupplied override.
      return {
        ...pnlRow,
        material: pnlRow.directMaterial,
        contribution: pnlRow.contributionMargin,
        netPnl: pnlRow.netPnl,
      };
    }),
  );
  const pnl = {
    revenue: pnlRows.reduce<Decimal>((a, r) => a.plus(r.revenue), zero()),
    labor: pnlRows.reduce<Decimal>((a, r) => a.plus(r.directLabor), zero()),
    material: pnlRows.reduce<Decimal>((a, r) => a.plus(r.material), zero()),
    other: pnlRows.reduce<Decimal>((a, r) => a.plus(r.directOther), zero()),
    contribution: pnlRows.reduce<Decimal>((a, r) => a.plus(r.contribution), zero()),
    overhead: pnlRows.reduce<Decimal>((a, r) => a.plus(r.overhead), zero()),
    netPnl: pnlRows.reduce<Decimal>((a, r) => a.plus(r.netPnl), zero()),
  };
  const contribNeg = pnl.contribution.lt(0);
  const netNeg = pnl.netPnl.lt(0);

  const scopedBilled = toDecimal(scopedBilledAgg._sum.grandTotal ?? 0);
  const allTimeBilled = toDecimal(allTimeBilledAgg._sum.grandTotal ?? 0);
  const receivables = toDecimal(receivablesAgg._sum.grandTotal ?? 0).minus(
    toDecimal(receivablesAgg._sum.amountPaid ?? 0),
  );

  const months: Date[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  }
  const trendMap = new Map<string, number>(
    months.map((m) => [monthKey(m), 0]),
  );
  trendInvoices.forEach((inv) => {
    if (!inv.issuedAt) return;
    const k = monthKey(inv.issuedAt);
    if (trendMap.has(k)) {
      trendMap.set(k, (trendMap.get(k) ?? 0) + toDecimal(inv.grandTotal).toNumber());
    }
  });
  const trendValues = months.map((m) => trendMap.get(monthKey(m)) ?? 0);
  const maxTrend = Math.max(1, ...trendValues);

  const workStatusRows = workStatusGroups
    .map((g) => ({
      key: g.workStatus ?? "— not set —",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  const totalProjects = workStatusRows.reduce((a, r) => a + r.count, 0);

  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  const cardLinkCls =
    "block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, ${session.user.name?.split(" ")[0] ?? "there"}`}
        description={`Portfolio · ${projects.length} projects · ${clientSet.size} clients · ${scopeLabel}${selectedDescription ? ` · ${selectedDescription}` : ""}`}
        actions={
          <>
            <DashboardFyFilter
              current={fyYear ? String(fyYear) : ""}
              options={fyYears.map((y) => ({
                value: String(y),
                label: istFyLabel(new Date(y, 5, 1)),
              }))}
            />
            <DashboardDescriptionFilter
              current={selectedDescription}
              options={descriptionOptions}
            />
            <Link href="/reports">
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </Link>
            <Link href="/projects/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New project
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href={
            fyYear
              ? `/projects?fy=${istFyLabel(new Date(fyYear, 5, 1))}`
              : "/projects"
          }
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label="Portfolio PO Value"
            value={formatINRCompact(poTotal)}
            sub={`${projectsInScope.length} POs · ${scopeLabel}`}
          />
        </Link>
        <Link
          href={
            fyYear
              ? `/invoices?fyLabel=${encodeURIComponent(istFyLabel(new Date(fyYear, 5, 1)))}`
              : "/invoices"
          }
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label={`Billed · ${scopeLabel}`}
            value={formatINRCompact(scopedBilled)}
            sub={`${scopedBilledAgg._count._all} invoices ${scopeLabel === "All-time" ? "all-time" : "in " + scopeLabel}`}
          />
        </Link>
        <Link
          href="/projects?needBill=yes"
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label="Outstanding Billable"
            value={formatINRCompact(outstandingBillable)}
            sub={`${needBillCount} POs need billing · ${scopeLabel}`}
          />
        </Link>
        <Link
          href="/invoices?status=ISSUED"
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label="Receivables"
            value={formatINRCompact(receivables)}
            sub={`${awaitingPaymentCount} invoices awaiting payment · ${scopeLabel}`}
          />
        </Link>
      </div>

      <div className="mb-5 rounded-md border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-slate-900">
              Portfolio P&L · {scopeLabel}
            </div>
            <div className="text-[11px] text-slate-500">
              Revenue, direct costs, overhead and net result across all projects
              {fyYear ? " (1-Apr → 31-Mar)" : " — all years combined"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="text-[11px] font-medium text-brand hover:underline"
            >
              Full P&L report →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <PnlStat label="Revenue" value={formatINRCompact(pnl.revenue)} />
          <PnlStat label="Labor" value={formatINRCompact(pnl.labor)} muted />
          <PnlStat label="Material" value={formatINRCompact(pnl.material)} muted />
          <PnlStat label="Other" value={formatINRCompact(pnl.other)} muted />
          <PnlStat
            label="Contribution"
            value={formatINRCompact(pnl.contribution)}
            tone={contribNeg ? "red" : "emerald"}
          />
          <PnlStat label="Overhead" value={formatINRCompact(pnl.overhead)} muted />
          <PnlStat
            label="Net P&L"
            value={formatINRCompact(pnl.netPnl)}
            tone={netNeg ? "red" : "emerald"}
            bold
          />
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-slate-900">
                Monthly billing · last 12 months
              </div>
              <div className="text-[11px] text-slate-500">
                Sum of ISSUED + PAID invoice value by month
              </div>
            </div>
            <div className="text-[11px] tabular-nums text-slate-600">
              Total {formatINRCompact(allTimeBilled)} · all-time
            </div>
          </div>
          <div className="flex h-44 items-end gap-2">
            {months.map((m, i) => {
              const v = trendValues[i];
              const h = Math.max(2, (v / maxTrend) * 100);
              return (
                <div
                  key={monthKey(m)}
                  className="flex-1 rounded-t-sm bg-brand transition hover:opacity-80"
                  style={{ height: `${h}%` }}
                  title={`${monthLabel(m)} · ${formatINR(v)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-500">
            {months
              .filter((_, i) => i % 2 === 0)
              .map((m) => (
                <span key={monthKey(m)}>{monthLabel(m)}</span>
              ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-[14px] font-semibold text-slate-900">
            Action items
          </div>
          <div className="text-[11px] text-slate-500">Where to look next</div>
          <ul className="mt-4 space-y-2 text-[12px]">
            <ActionItem
              href="/projects?needBill=yes"
              label="POs with unbilled balance"
              value={needBillCount}
              money={formatINRCompact(outstandingBillable)}
              tone={needBillCount > 0 ? "amber" : "slate"}
            />
            <ActionItem
              href="/invoices?status=ISSUED"
              label="Invoices awaiting payment"
              value={awaitingPaymentCount}
              money={formatINRCompact(receivables)}
              tone={awaitingPaymentCount > 0 ? "sky" : "slate"}
            />
            <ActionItem
              href="/projects?fyNone=yes"
              label="Projects missing PO date"
              value={noPoDateCount}
              tone={noPoDateCount > 0 ? "slate" : "emerald"}
            />
            <ActionItem
              href="/projects?responseNone=yes"
              label="Projects without response owner"
              value={noResponseCount}
              tone={noResponseCount > 0 ? "slate" : "emerald"}
            />
            <ActionItem
              href="/timesheets"
              label="Open timesheets"
              value={openTimesheets}
              tone={openTimesheets > 0 ? "slate" : "emerald"}
            />
            <ActionItem
              href="/inventory"
              label="Active SKUs"
              value={materialsCount}
              tone="slate"
            />
          </ul>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-slate-900">
              Work status
            </div>
            <Link
              href="/projects"
              className="text-[11px] font-medium text-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          <dl className="space-y-1.5 text-[12px]">
            {workStatusRows.map((w) => {
              const pct = totalProjects
                ? Math.round((w.count / totalProjects) * 100)
                : 0;
              const isFilterable = w.key !== "— not set —";
              const content = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="truncate text-slate-700">{w.key}</dt>
                    <dd className="flex shrink-0 items-center gap-3 tabular-nums">
                      <span className="text-slate-500">{pct}%</span>
                      <span className="font-semibold text-slate-900">
                        {w.count}
                      </span>
                    </dd>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              );
              return isFilterable ? (
                <Link
                  key={w.key}
                  href={`/projects?workStatus=${encodeURIComponent(w.key)}`}
                  scroll={false}
                  className="-mx-2 block rounded px-2 py-1.5 transition hover:bg-slate-50"
                >
                  {content}
                </Link>
              ) : (
                <div key={w.key} className="-mx-2 block rounded px-2 py-1.5">
                  {content}
                </div>
              );
            })}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-slate-900">
              Top 5 clients
            </div>
            <Link
              href="/clients"
              className="text-[11px] font-medium text-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          <dl className="space-y-2 text-[12px]">
            {topClients.map(([name, value]) => (
              <Link
                key={name}
                href={`/projects?clientName=${encodeURIComponent(name)}`}
                scroll={false}
                className="-mx-2 flex items-center justify-between gap-3 rounded px-2 py-1.5 transition hover:bg-slate-50"
              >
                <dt className="truncate font-medium text-slate-800" title={name}>
                  {name}
                </dt>
                <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {formatINRCompact(value)}
                </dd>
              </Link>
            ))}
            {topClients.length === 0 && (
              <div className="text-slate-500">No clients yet.</div>
            )}
          </dl>
        </div>
      </div>

    </div>
  );
}

function PnlStat({
  label,
  value,
  tone,
  bold,
  muted,
}: {
  label: string;
  value: string;
  tone?: "red" | "emerald";
  bold?: boolean;
  muted?: boolean;
}) {
  const valueCls =
    tone === "red"
      ? "text-red-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : muted
          ? "text-slate-700"
          : "text-slate-900";
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={
          (bold ? "text-[16px] font-semibold " : "text-[14px] font-medium ") +
          "tabular-nums " +
          valueCls
        }
      >
        {value}
      </div>
    </div>
  );
}

function ActionItem({
  href,
  label,
  value,
  money,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  money?: string;
  tone: "amber" | "sky" | "emerald" | "slate";
}) {
  const dotCls =
    tone === "amber"
      ? "bg-amber-500"
      : tone === "sky"
        ? "bg-sky-500"
        : tone === "emerald"
          ? "bg-emerald-500"
          : "bg-slate-400";
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-center justify-between rounded px-2 py-1.5 transition hover:bg-slate-50"
      >
        <span className="flex items-center gap-2 text-slate-700">
          <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
          {label}
        </span>
        <span className="flex items-center gap-2 tabular-nums">
          {money && <span className="text-[11px] text-slate-500">{money}</span>}
          <span className="min-w-[24px] text-right font-semibold text-slate-900">
            {value}
          </span>
          <ArrowUpRight className="h-3 w-3 text-slate-400" />
        </span>
      </Link>
    </li>
  );
}
