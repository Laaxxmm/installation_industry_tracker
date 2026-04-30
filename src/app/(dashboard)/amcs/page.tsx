import Link from "next/link";
import { Plus } from "lucide-react";
import { AMCStatus, Role, AMCVisitStatus } from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { Code, KPI, PageHeader, Pill, fmtDate, inr } from "@/components/sab";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const AMC_STATUS_LABELS: Record<AMCStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  RENEWED: "Renewed",
};

const STATUS_TONE: Record<AMCStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  DRAFT: "ink",
  PENDING_APPROVAL: "amber",
  ACTIVE: "positive",
  ON_HOLD: "amber",
  EXPIRED: "ink",
  CANCELLED: "alert",
  RENEWED: "blue",
};

const BILLING_LABEL = {
  ANNUAL: "Annual",
  INSTALLMENTS: "Installments",
  PER_VISIT: "Per-visit",
};

export default async function AMCListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";

  const amcWhere = {
    ...(q
      ? {
          OR: [
            { contractNo: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { status: status as AMCStatus } : {}),
  };

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);

  const [amcs, totalCount, activeCount, expiringCount, visitsThisWeek, bookedYTD] = await Promise.all([
    db.aMC.findMany({
      where: amcWhere,
      orderBy: [{ status: "asc" }, { endDate: "asc" }],
      take: 300,
      include: {
        client: { select: { name: true } },
        _count: { select: { visits: true } },
      },
    }),
    db.aMC.count(),
    db.aMC.count({ where: { status: AMCStatus.ACTIVE } }),
    db.aMC.count({
      where: { status: AMCStatus.ACTIVE, endDate: { gte: now, lte: in30Days } },
    }),
    db.aMCVisit.count({
      where: {
        scheduledDate: { gte: startOfWeek, lt: endOfWeek },
        status: AMCVisitStatus.SCHEDULED,
      },
    }),
    db.aMC.aggregate({
      _sum: { grandTotal: true },
      where: { status: { in: [AMCStatus.ACTIVE, AMCStatus.RENEWED, AMCStatus.EXPIRED] }, activatedAt: { gte: fyStart } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="After-sales"
        title="AMC contracts"
        description={`${activeCount} active · ${expiringCount} expiring ≤30 days · ${inr(Number(bookedYTD._sum.grandTotal ?? 0))} booked YTD`}
        actions={
          canCreate ? (
            <Link href="/amcs/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New AMC
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Active contracts" value={activeCount} sub="Currently delivering" accent />
        <KPI label="Expiring ≤30d" value={expiringCount} sub="Renewal window" />
        <KPI label="Visits this week" value={visitsThisWeek} sub="Scheduled" />
        <KPI
          label="Contract value (YTD)"
          value={inr(Number(bookedYTD._sum.grandTotal ?? 0))}
          sub="Booked since April 1"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search contract no, title, or client…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(AMC_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status) && (
          <span className="text-[11px] text-slate-500">
            {amcs.length} of {totalCount} contract{totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div
        className="overflow-hidden rounded border"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <table className="w-full text-[12.5px] sab-tabular">
          <thead>
            <tr
              className="border-b"
              style={{ background: "var(--sab-paper-alt)", borderColor: "hsl(var(--border))" }}
            >
              {["Contract", "Client", "Status", "Billing", "Window", "Value", "Visits"].map((h, i) => (
                <th
                  key={h}
                  className={`sab-caps px-3 py-2.5 ${i === 5 ? "text-right" : "text-left"}`}
                  style={{ color: "var(--sab-ink3)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amcs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px]"
                  style={{ color: "var(--sab-ink3)" }}
                >
                  No AMCs yet.{" "}
                  {canCreate && (
                    <Link href="/amcs/new" className="underline" style={{ color: "hsl(var(--primary))" }}>
                      Create the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {amcs.map((a) => (
              <tr
                key={a.id}
                className="border-b transition-colors hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/amcs/${a.id}`}
                    className="block font-semibold"
                    style={{ color: "var(--sab-ink)" }}
                  >
                    {a.title}
                  </Link>
                  <div className="mt-0.5 sab-code" style={{ fontSize: 10 }}>
                    <Code>{a.contractNo}</Code>
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {a.client.name}
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={STATUS_TONE[a.status]} size="sm">
                    {a.status}
                  </Pill>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {BILLING_LABEL[a.billingMode]} · {a.frequency.toLowerCase()}
                </td>
                <td className="px-3 py-2.5 sab-code" style={{ fontSize: 11, color: "var(--sab-ink2)" }}>
                  {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: "var(--sab-ink)" }}>
                  {inr(Number(a.grandTotal))}
                </td>
                <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--sab-ink2)" }}>
                  {a._count.visits}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {amcs.length >= 300 && totalCount > amcs.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing 300 of {totalCount} contracts. Refine search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
