import Link from "next/link";
import { Decimal } from "decimal.js";
import { StatCard } from "@/components/ui/stat-card";
import { formatINR, formatINRCompact, toDecimal } from "@/lib/money";
import type { ProjectRow } from "./ProjectsTable";

type PoStatusBreakdown = {
  issued: number;
  draft: number;
  cancelled: number;
  none: number;
};

type WorkStatusRow = { key: string; count: number; poValue: Decimal };

type ClientRow = {
  name: string;
  pos: number;
  poValue: Decimal;
  billed: Decimal;
  outstanding: Decimal;
};

type ResponseRow = {
  key: string;
  count: number;
  poValue: Decimal;
  outstanding: Decimal;
};

type FyRow = {
  key: string;
  count: number;
  poValue: Decimal;
  billed: Decimal;
  outstanding: Decimal;
};

function percent(part: Decimal, whole: Decimal): string {
  if (whole.isZero()) return "0%";
  return `${part.div(whole).times(100).toDecimalPlaces(1).toString()}%`;
}

function filterHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export function ProjectsDashboard({ rows }: { rows: ProjectRow[] }) {
  let poTotal = new Decimal(0);
  let billedTotal = new Decimal(0);
  let adjTotal = new Decimal(0);
  let billableTotal = new Decimal(0);
  let needBillCount = 0;

  const poStatus: PoStatusBreakdown = { issued: 0, draft: 0, cancelled: 0, none: 0 };
  const workStatus = new Map<string, WorkStatusRow>();
  const clients = new Map<string, ClientRow>();
  const responses = new Map<string, ResponseRow>();
  const fys = new Map<string, FyRow>();

  for (const r of rows) {
    const po = toDecimal(r.contractValue);
    const billed = toDecimal(r.billedValue);
    const adj = toDecimal(r.adjBillableValue);
    const billable = po.minus(billed).minus(adj);
    const outstanding = billable.isNegative() ? new Decimal(0) : billable;

    poTotal = poTotal.plus(po);
    billedTotal = billedTotal.plus(billed);
    adjTotal = adjTotal.plus(adj);
    billableTotal = billableTotal.plus(outstanding);
    if (billable.greaterThan(0)) needBillCount++;

    if (r.poStatus === "ISSUED") poStatus.issued++;
    else if (r.poStatus === "DRAFT") poStatus.draft++;
    else if (r.poStatus === "CANCELLED") poStatus.cancelled++;
    else poStatus.none++;

    const wkey = r.workStatus ?? "— not set —";
    const w = workStatus.get(wkey) ?? { key: wkey, count: 0, poValue: new Decimal(0) };
    w.count++;
    w.poValue = w.poValue.plus(po);
    workStatus.set(wkey, w);

    const ckey = r.clientName || "—";
    const c = clients.get(ckey) ?? {
      name: ckey,
      pos: 0,
      poValue: new Decimal(0),
      billed: new Decimal(0),
      outstanding: new Decimal(0),
    };
    c.pos++;
    c.poValue = c.poValue.plus(po);
    c.billed = c.billed.plus(billed);
    c.outstanding = c.outstanding.plus(outstanding);
    clients.set(ckey, c);

    const rkey = (r.response && r.response.trim()) || "— not set —";
    const resp = responses.get(rkey) ?? {
      key: rkey,
      count: 0,
      poValue: new Decimal(0),
      outstanding: new Decimal(0),
    };
    resp.count++;
    resp.poValue = resp.poValue.plus(po);
    resp.outstanding = resp.outstanding.plus(outstanding);
    responses.set(rkey, resp);

    const fykey = r.fy || "— not set —";
    const fy = fys.get(fykey) ?? {
      key: fykey,
      count: 0,
      poValue: new Decimal(0),
      billed: new Decimal(0),
      outstanding: new Decimal(0),
    };
    fy.count++;
    fy.poValue = fy.poValue.plus(po);
    fy.billed = fy.billed.plus(billed);
    fy.outstanding = fy.outstanding.plus(outstanding);
    fys.set(fykey, fy);
  }

  const workRows = [...workStatus.values()].sort((a, b) =>
    b.poValue.comparedTo(a.poValue),
  );
  const topClients = [...clients.values()]
    .sort((a, b) => b.poValue.comparedTo(a.poValue))
    .slice(0, 5);
  const responseRows = [...responses.values()].sort((a, b) =>
    b.poValue.comparedTo(a.poValue),
  );
  const fyRows = [...fys.values()].sort((a, b) => {
    if (a.key === "— not set —") return 1;
    if (b.key === "— not set —") return -1;
    return b.key.localeCompare(a.key);
  });

  const cardLinkCls =
    "block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <div className="mb-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={filterHref({})} scroll={false} className={cardLinkCls}>
          <StatCard
            label="Total PO Value"
            value={formatINRCompact(poTotal)}
            sub={`${rows.length} POs · inc GST`}
          />
        </Link>
        <Link
          href={filterHref({ hasBilled: "yes" })}
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label="Billed"
            value={formatINRCompact(billedTotal)}
            sub={`${percent(billedTotal, poTotal)} of PO value`}
          />
        </Link>
        <Link
          href={filterHref({ needBill: "yes" })}
          scroll={false}
          className={cardLinkCls}
        >
          <StatCard
            label="Outstanding Billable"
            value={formatINRCompact(billableTotal)}
            sub={`${needBillCount} POs need billing`}
          />
        </Link>
        <Link href={filterHref({})} scroll={false} className={cardLinkCls}>
          <StatCard
            label="Adj. Billable"
            value={formatINRCompact(adjTotal)}
            sub="Scope-change adjustments"
          />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            PO Status
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            <StatusRow
              href={filterHref({ poStatus: "ISSUED" })}
              label="Issued"
              value={poStatus.issued}
              total={rows.length}
              dot="emerald"
            />
            <StatusRow
              href={filterHref({ poStatus: "DRAFT" })}
              label="Pending (Draft)"
              value={poStatus.draft}
              total={rows.length}
              dot="amber"
            />
            <StatusRow
              href={filterHref({ poStatus: "CANCELLED" })}
              label="Cancelled"
              value={poStatus.cancelled}
              total={rows.length}
              dot="red"
            />
            {poStatus.none > 0 && (
              <StatusRow
                href={filterHref({ poStatusNone: "yes" })}
                label="Not set"
                value={poStatus.none}
                total={rows.length}
                dot="slate"
              />
            )}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Work Status
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            {workRows.map((w) => {
              const content = (
                <>
                  <dt className="truncate text-slate-700">{w.key}</dt>
                  <dd className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-slate-500">{w.count}</span>
                    <span className="font-medium text-slate-900">
                      {formatINRCompact(w.poValue)}
                    </span>
                  </dd>
                </>
              );
              const rowCls =
                "flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 last:pb-0";
              const isFilterable = w.key !== "— not set —";
              return isFilterable ? (
                <Link
                  key={w.key}
                  href={filterHref({ workStatus: w.key })}
                  scroll={false}
                  className={`${rowCls} -mx-2 rounded px-2 hover:bg-slate-50`}
                >
                  {content}
                </Link>
              ) : (
                <div key={w.key} className={rowCls}>
                  {content}
                </div>
              );
            })}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Top 5 Clients
            </div>
            <div className="text-[10px] text-slate-500">by PO value</div>
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            {topClients.map((c) => (
              <Link
                key={c.name}
                href={filterHref({ clientName: c.name })}
                scroll={false}
                className="-mx-2 block rounded px-2 py-1.5 transition hover:bg-slate-50 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <dt
                    className="truncate font-medium text-slate-800"
                    title={c.name}
                  >
                    {c.name}
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {formatINRCompact(c.poValue)}
                  </dd>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
                  <span>{c.pos} POs</span>
                  <span>
                    Billed {formatINRCompact(c.billed)} · Outstanding{" "}
                    {formatINRCompact(c.outstanding)}
                  </span>
                </div>
              </Link>
            ))}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Response
            </div>
            <div className="text-[10px] text-slate-500">by owner</div>
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            {responseRows.map((resp) => {
              const content = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="truncate font-medium text-slate-800" title={resp.key}>
                      {resp.key}
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {formatINRCompact(resp.poValue)}
                    </dd>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
                    <span>{resp.count} POs</span>
                    <span>Outstanding {formatINRCompact(resp.outstanding)}</span>
                  </div>
                </>
              );
              const rowCls =
                "-mx-2 block rounded px-2 py-1.5 border-b border-slate-100 last:border-0";
              const isNone = resp.key === "— not set —";
              const href = isNone
                ? filterHref({ responseNone: "yes" })
                : filterHref({ response: resp.key });
              return (
                <Link
                  key={resp.key}
                  href={href}
                  scroll={false}
                  className={`${rowCls} transition hover:bg-slate-50`}
                >
                  {content}
                </Link>
              );
            })}
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Financial Year
            </div>
            <div className="text-[10px] text-slate-500">by PO date</div>
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            {fyRows.map((fy) => {
              const content = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="truncate font-medium text-slate-800" title={fy.key}>
                      {fy.key}
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {formatINRCompact(fy.poValue)}
                    </dd>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500 tabular-nums">
                    <span>{fy.count} POs</span>
                    <span>
                      Billed {formatINRCompact(fy.billed)} · Outstanding{" "}
                      {formatINRCompact(fy.outstanding)}
                    </span>
                  </div>
                </>
              );
              const rowCls =
                "-mx-2 block rounded px-2 py-1.5 border-b border-slate-100 last:border-0";
              const isNone = fy.key === "— not set —";
              const href = isNone
                ? filterHref({ fyNone: "yes" })
                : filterHref({ fy: fy.key });
              return (
                <Link
                  key={fy.key}
                  href={href}
                  scroll={false}
                  className={`${rowCls} transition hover:bg-slate-50`}
                >
                  {content}
                </Link>
              );
            })}
          </dl>
        </div>
      </div>

      <div className="text-right text-[10px] text-slate-500">
        Full billed ledger: {formatINR(billedTotal)} · Outstanding billable:{" "}
        {formatINR(billableTotal)}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  total,
  dot,
  href,
}: {
  label: string;
  value: number;
  total: number;
  dot: "emerald" | "amber" | "red" | "slate";
  href?: string;
}) {
  const dotClass =
    dot === "emerald"
      ? "bg-emerald-500"
      : dot === "amber"
        ? "bg-amber-500"
        : dot === "red"
          ? "bg-red-500"
          : "bg-slate-400";
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const rowCls =
    "flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0 last:pb-0";
  const content = (
    <>
      <dt className="flex items-center gap-2 text-slate-700">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </dt>
      <dd className="flex shrink-0 items-center gap-3 tabular-nums">
        <span className="text-slate-500">{pct}%</span>
        <span className="font-medium text-slate-900">{value}</span>
      </dd>
    </>
  );
  if (!href || value === 0) {
    return <div className={rowCls}>{content}</div>;
  }
  return (
    <Link
      href={href}
      scroll={false}
      className={`${rowCls} -mx-2 rounded px-2 hover:bg-slate-50`}
    >
      {content}
    </Link>
  );
}
