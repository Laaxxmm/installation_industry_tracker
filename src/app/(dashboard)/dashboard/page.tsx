import Link from "next/link";
import { Decimal } from "decimal.js";
import { InvoiceStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { getProjectPnl } from "@/server/actions/pnl";
import { DashboardFyFilter } from "./DashboardFyFilter";
import { DashboardDescriptionFilter } from "./DashboardDescriptionFilter";
import { toDecimal, zero } from "@/lib/money";
import { istFyStart, istFyEnd, istFyLabel } from "@/lib/time";
import {
  Btn,
  Icon,
  KPI,
  PageHeader,
  SAB,
  Sparkbars,
  Sparkline,
  inr,
} from "@/components/sab";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-IN", { month: "short" });
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
  const scopeLabel = fyYear ? istFyLabel(new Date(fyYear, 5, 1)) : "All-time";

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
    billedByProjectAgg.map((b) => [b.projectId, toDecimal(b._sum.grandTotal ?? 0)]),
  );

  let noPoDateCount = 0;
  let noResponseCount = 0;
  const clientSet = new Set<string>();
  const clientTotals = new Map<string, { pov: Decimal; pos: number; billed: Decimal }>();
  for (const p of projects) {
    const po = toDecimal(p.contractValue);
    const billed = billedByProject.get(p.id) ?? new Decimal(0);
    if (!p.poDate) noPoDateCount++;
    if (!p.response || !p.response.trim()) noResponseCount++;
    if (p.clientName) {
      clientSet.add(p.clientName);
      const cur = clientTotals.get(p.clientName) ?? { pov: new Decimal(0), pos: 0, billed: new Decimal(0) };
      clientTotals.set(p.clientName, {
        pov: cur.pov.plus(po),
        pos: cur.pos + 1,
        billed: cur.billed.plus(billed),
      });
    }
  }
  const topClients = [...clientTotals.entries()]
    .sort((a, b) => b[1].pov.comparedTo(a[1].pov))
    .slice(0, 5);

  const projectsInScope = scopeRange
    ? projects.filter(
        (p) => p.poDate !== null && p.poDate >= scopeRange.from && p.poDate < scopeRange.to,
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

  const pnlRange = scopeRange ?? { from: new Date("2000-01-01"), to: new Date("2099-12-31") };
  const pnlRows = await Promise.all(
    projectsInScope.map(async (p) => {
      const pnlRow = await getProjectPnl(p.id, pnlRange);
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
  const marginPct = pnl.revenue.isZero()
    ? 0
    : pnl.netPnl.dividedBy(pnl.revenue).times(100).toDecimalPlaces(1).toNumber();

  const scopedBilled = toDecimal(scopedBilledAgg._sum.grandTotal ?? 0);
  const allTimeBilled = toDecimal(allTimeBilledAgg._sum.grandTotal ?? 0);
  const receivables = toDecimal(receivablesAgg._sum.grandTotal ?? 0).minus(
    toDecimal(receivablesAgg._sum.amountPaid ?? 0),
  );

  const months: Date[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(new Date(now.getFullYear(), now.getMonth() - 11 + i, 1));
  }
  const trendMap = new Map<string, number>(months.map((m) => [monthKey(m), 0]));
  trendInvoices.forEach((inv) => {
    if (!inv.issuedAt) return;
    const k = monthKey(inv.issuedAt);
    if (trendMap.has(k)) {
      trendMap.set(k, (trendMap.get(k) ?? 0) + toDecimal(inv.grandTotal).toNumber());
    }
  });
  const trendValues = months.map((m) => trendMap.get(monthKey(m)) ?? 0);
  const maxTrend = Math.max(1, ...trendValues);

  const STATUS_TONE: Record<string, keyof typeof SAB> = {
    "In progress": "accent",
    "Completed": "positive",
    "On hold": "amber",
    "Cancelled": "alert",
  };
  const workStatusRows = workStatusGroups
    .map((g) => ({
      key: g.workStatus ?? "— not set —",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  const totalProjects = workStatusRows.reduce((a, r) => a + r.count, 0);

  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Overview"
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
            <Link href="/reports" style={{ textDecoration: "none" }}>
              <Btn variant="outline" size="sm" icon="download">
                Export
              </Btn>
            </Link>
            <Link href="/projects/new" style={{ textDecoration: "none" }}>
              <Btn variant="primary" size="sm" icon="plus">
                New project
              </Btn>
            </Link>
          </>
        }
      />

      {/* ─── 4 KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <Link href={fyYear ? `/projects?fy=${istFyLabel(new Date(fyYear, 5, 1))}` : "/projects"} style={{ textDecoration: "none" }}>
          <KPI
            label="Portfolio PO Value"
            value={inr(poTotal.toNumber())}
            sub={`${projectsInScope.length} POs · ${scopeLabel}`}
            spark={<Sparkline values={trendValues} width={140} height={24} />}
          />
        </Link>
        <Link
          href={fyYear ? `/invoices?fyLabel=${encodeURIComponent(istFyLabel(new Date(fyYear, 5, 1)))}` : "/invoices"}
          style={{ textDecoration: "none" }}
        >
          <KPI
            label={`Billed · ${scopeLabel}`}
            value={inr(scopedBilled.toNumber())}
            sub={`${scopedBilledAgg._count._all} invoices ${scopeLabel === "All-time" ? "all-time" : "in " + scopeLabel}`}
            spark={<Sparkbars values={trendValues} height={24} />}
          />
        </Link>
        <Link href="/projects?needBill=yes" style={{ textDecoration: "none" }}>
          <KPI
            label="Outstanding billable"
            value={inr(outstandingBillable.toNumber())}
            sub={`${needBillCount} POs need billing · ${scopeLabel}`}
            accent
          />
        </Link>
        <Link href="/invoices?status=ISSUED" style={{ textDecoration: "none" }}>
          <KPI
            label="Receivables"
            value={inr(receivables.toNumber())}
            sub={`${awaitingPaymentCount} invoices awaiting payment · ${scopeLabel}`}
          />
        </Link>
      </div>

      {/* ─── PnL strip ─────────────────────────────────── */}
      <div
        style={{
          marginTop: 16,
          background: SAB.card,
          border: `1px solid ${SAB.rule}`,
          borderRadius: 4,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: SAB.ink }}>
              Portfolio P&amp;L · {scopeLabel}
            </div>
            <div style={{ fontSize: 11.5, color: SAB.ink3, marginTop: 2 }}>
              Revenue less direct costs and overhead, computed on-demand from invoices + ledger
            </div>
          </div>
          <Link
            href="/reports"
            style={{
              fontSize: 12,
              color: SAB.accentInk,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Full P&amp;L report →
          </Link>
        </div>
        <PnlStrip
          revenue={pnl.revenue.toNumber()}
          labor={pnl.labor.toNumber()}
          material={pnl.material.toNumber()}
          other={pnl.other.toNumber()}
          contribution={pnl.contribution.toNumber()}
          overhead={pnl.overhead.toNumber()}
          netPnl={pnl.netPnl.toNumber()}
          marginPct={marginPct}
        />
      </div>

      {/* ─── Billing chart + Action items ──────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div style={{ background: SAB.card, border: `1px solid ${SAB.rule}`, borderRadius: 4, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SAB.ink }}>
                Monthly billing · last 12 months
              </div>
              <div style={{ fontSize: 11.5, color: SAB.ink3, marginTop: 2 }}>
                Sum of ISSUED + PAID invoice value by month
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                fontSize: 11,
                color: SAB.ink3,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Total {inr(allTimeBilled.toNumber())} · all-time
            </div>
          </div>
          <BillingChart values={trendValues} months={months} maxVal={maxTrend} />
        </div>

        <div style={{ background: SAB.card, border: `1px solid ${SAB.rule}`, borderRadius: 4, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: SAB.ink }}>Action items</div>
          <div style={{ fontSize: 11.5, color: SAB.ink3, marginTop: 2 }}>
            Where to look next
          </div>
          <div style={{ marginTop: 12 }}>
            <ActionItem
              href="/projects?needBill=yes"
              label="POs with unbilled balance"
              value={needBillCount}
              money={inr(outstandingBillable.toNumber())}
              tone={needBillCount > 0 ? "amber" : "ink3"}
              first
            />
            <ActionItem
              href="/invoices?status=ISSUED"
              label="Invoices awaiting payment"
              value={awaitingPaymentCount}
              money={inr(receivables.toNumber())}
              tone={awaitingPaymentCount > 0 ? "blue" : "ink3"}
            />
            <ActionItem
              href="/projects?fyNone=yes"
              label="Projects missing PO date"
              value={noPoDateCount}
              tone={noPoDateCount > 0 ? "ink3" : "positive"}
            />
            <ActionItem
              href="/projects?responseNone=yes"
              label="Projects without response owner"
              value={noResponseCount}
              tone={noResponseCount > 0 ? "ink3" : "positive"}
            />
            <ActionItem
              href="/timesheets"
              label="Open timesheets"
              value={openTimesheets}
              tone={openTimesheets > 0 ? "ink3" : "positive"}
            />
            <ActionItem
              href="/inventory"
              label="Active SKUs"
              value={materialsCount}
              tone="ink3"
            />
          </div>
        </div>
      </div>

      {/* ─── Work status + Top 5 clients ──────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 pb-6 lg:grid-cols-2">
        <div style={{ background: SAB.card, border: `1px solid ${SAB.rule}`, borderRadius: 4, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: SAB.ink }}>Work status</div>
            <Link href="/projects" style={{ fontSize: 11, color: SAB.accentInk, textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {workStatusRows.map((w, i) => {
            const pct = totalProjects ? Math.round((w.count / totalProjects) * 100) : 0;
            const tone = STATUS_TONE[w.key] ?? "ink3";
            const filterable = w.key !== "— not set —";
            const content = (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 6,
                        background: (SAB as Record<string, string>)[tone as string],
                      }}
                    />
                    <span style={{ color: SAB.ink2 }}>{w.key}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                        fontSize: 11,
                        color: SAB.ink3,
                      }}
                    >
                      {pct}%
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: SAB.ink,
                        minWidth: 24,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {w.count}
                    </span>
                  </div>
                </div>
                <div style={{ height: 2, background: SAB.rule, marginTop: 5, overflow: "hidden", borderRadius: 2 }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      maxWidth: "100%",
                      height: "100%",
                      background: (SAB as Record<string, string>)[tone as string],
                      opacity: 0.8,
                    }}
                  />
                </div>
              </>
            );
            const rowStyle: React.CSSProperties = {
              padding: "7px 0",
              borderTop: i > 0 ? `1px dashed ${SAB.rule}` : "none",
              display: "block",
              textDecoration: "none",
            };
            return filterable ? (
              <Link
                key={w.key}
                href={`/projects?workStatus=${encodeURIComponent(w.key)}`}
                style={rowStyle}
              >
                {content}
              </Link>
            ) : (
              <div key={w.key} style={rowStyle}>
                {content}
              </div>
            );
          })}
        </div>

        <div style={{ background: SAB.card, border: `1px solid ${SAB.rule}`, borderRadius: 4, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SAB.ink }}>Top 5 clients</div>
              <div style={{ fontSize: 11, color: SAB.ink3, marginTop: 1 }}>by PO value</div>
            </div>
            <Link href="/clients" style={{ fontSize: 11, color: SAB.accentInk, textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {topClients.map(([name, v], i) => {
            const pct = v.pov.isZero() ? 0 : v.billed.dividedBy(v.pov).times(100).toNumber();
            const outstanding = v.pov.minus(v.billed);
            return (
              <Link
                key={name}
                href={`/projects?clientName=${encodeURIComponent(name)}`}
                style={{
                  display: "block",
                  padding: "8px 0",
                  borderTop: i > 0 ? `1px dashed ${SAB.rule}` : "none",
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                  <div
                    style={{
                      color: SAB.ink,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                      fontSize: 11.5,
                      color: SAB.ink,
                      fontWeight: 600,
                      flex: "none",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {inr(v.pov.toNumber())}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                    fontSize: 10,
                    color: SAB.ink3,
                    marginTop: 3,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span>
                    {v.pos} POs · billed {inr(v.billed.toNumber())}
                  </span>
                  <span>out {inr(outstanding.toNumber())}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    height: 3,
                    background: SAB.rule,
                    marginTop: 5,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: `${pct}%`, background: SAB.positive }} />
                  <div style={{ width: `${100 - pct}%`, background: SAB.accent, opacity: 0.35 }} />
                </div>
              </Link>
            );
          })}
          {topClients.length === 0 && (
            <div style={{ fontSize: 12, color: SAB.ink3, padding: "8px 0" }}>No clients yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PnlStrip({
  revenue,
  labor,
  material,
  other,
  contribution,
  overhead,
  netPnl,
  marginPct,
}: {
  revenue: number;
  labor: number;
  material: number;
  other: number;
  contribution: number;
  overhead: number;
  netPnl: number;
  marginPct: number;
}) {
  const cols: { k: string; v: number; tone: "ink" | "muted" | "positive" | "alert"; bold?: boolean; hero?: boolean }[] = [
    { k: "Revenue", v: revenue, tone: "ink", bold: true },
    { k: "Labor", v: labor, tone: "muted" },
    { k: "Material", v: material, tone: "muted" },
    { k: "Other", v: other, tone: "muted" },
    { k: "Contribution", v: contribution, tone: contribution >= 0 ? "positive" : "alert" },
    { k: "Overhead", v: overhead, tone: "muted" },
    { k: "Net P&L", v: netPnl, tone: netPnl >= 0 ? "positive" : "alert", bold: true, hero: true },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 1,
        background: SAB.rule,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      {cols.map((c) => {
        const fg =
          c.tone === "positive"
            ? SAB.positive
            : c.tone === "alert"
              ? SAB.alert
              : c.tone === "muted"
                ? SAB.ink2
                : SAB.ink;
        return (
          <div
            key={c.k}
            style={{
              padding: "12px 14px",
              background: c.hero ? SAB.accentWash : SAB.card,
            }}
          >
            <div className="sab-caps">{c.k}</div>
            <div
              style={{
                fontSize: c.bold ? 18 : 15,
                fontWeight: c.bold ? 600 : 500,
                color: c.hero ? SAB.accentInk : fg,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {inr(c.v)}
            </div>
            {c.hero && (
              <div
                style={{
                  fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                  fontSize: 10,
                  color: netPnl >= 0 ? SAB.positive : SAB.alert,
                  marginTop: 2,
                }}
              >
                {marginPct}% margin
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BillingChart({
  values,
  months,
  maxVal,
}: {
  values: number[];
  months: Date[];
  maxVal: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          height: 140,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${t * 100}%`,
                borderTop: `1px dashed ${SAB.rule}`,
              }}
            />
          ))}
        </div>
        {values.map((v, i) => {
          const h = Math.max(2, (v / maxVal) * 100);
          const last = i === values.length - 1;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  height: `${h}%`,
                  background: last ? SAB.accent : SAB.ink,
                  opacity: last ? 1 : 0.82,
                  borderRadius: "1px 1px 0 0",
                  position: "relative",
                }}
              >
                {last && v > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -22,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: SAB.accentInk,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inr(v)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {months.map((m, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
              fontSize: 9.5,
              color: SAB.ink3,
            }}
          >
            {monthLabel(m)}
          </div>
        ))}
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
  first = false,
}: {
  href: string;
  label: string;
  value: number;
  money?: string;
  tone: "amber" | "blue" | "alert" | "positive" | "ink3";
  first?: boolean;
}) {
  const dot: Record<string, string> = {
    amber: SAB.amber,
    blue: SAB.blue,
    alert: SAB.alert,
    positive: SAB.positive,
    ink3: SAB.ink3,
  };
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: first ? "none" : `1px dashed ${SAB.rule}`,
        textDecoration: "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 6,
          background: dot[tone],
          flex: "none",
        }}
      />
      <div style={{ flex: 1, fontSize: 12.5, color: SAB.ink2 }}>{label}</div>
      {money && (
        <div
          style={{
            fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
            fontSize: 11,
            color: SAB.ink3,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {money}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: SAB.ink,
          minWidth: 28,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <Icon name="chevRight" size={12} style={{ color: SAB.ink4 }} />
    </Link>
  );
}
