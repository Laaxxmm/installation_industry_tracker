import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, QuoteStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { QuoteStatusPill } from "./QuoteStatusPill";
import { ExpireStaleButton } from "./ExpireStaleButton";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CHANGES_REQUESTED: "Changes requested",
  REVISED: "Revised",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Accepted",
  CONVERTED: "Converted",
  LOST: "Lost",
  EXPIRED: "Expired",
};

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";

  const where = {
    ...(q
      ? {
          OR: [
            { quoteNo: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { status: status as QuoteStatus } : {}),
  };

  const OPEN_STATUSES: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.SENT,
    QuoteStatus.CHANGES_REQUESTED,
    QuoteStatus.NEGOTIATING,
    QuoteStatus.REVISED,
    QuoteStatus.ACCEPTED,
  ];

  // Parallel: capped list + per-status counts + open pipeline sum. Aggregates
  // run in Postgres so we don't drag every Quote row back just to group & sum.
  const [quotes, statusGroups, openPipelineAgg] = await Promise.all([
    db.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { client: { select: { name: true } } },
    }),
    db.quote.groupBy({ by: ["status"], _count: { _all: true } }),
    db.quote.aggregate({
      where: { status: { in: OPEN_STATUSES } },
      _sum: { grandTotal: true },
    }),
  ]);

  const countOf = (s: QuoteStatus) =>
    statusGroups.find((g) => g.status === s)?._count._all ?? 0;
  const totalQuoteCount = statusGroups.reduce((a, g) => a + g._count._all, 0);
  const counts = {
    draft: countOf(QuoteStatus.DRAFT),
    sent: countOf(QuoteStatus.SENT),
    negotiating:
      countOf(QuoteStatus.CHANGES_REQUESTED) +
      countOf(QuoteStatus.NEGOTIATING) +
      countOf(QuoteStatus.REVISED),
    accepted: countOf(QuoteStatus.ACCEPTED),
    converted: countOf(QuoteStatus.CONVERTED),
  };
  const openPipelineValue = Number(openPipelineAgg._sum.grandTotal ?? 0);

  return (
    <div>
      <PageHeader
        eyebrow="Sales pipeline"
        title="Quotes"
        description={`${totalQuoteCount} total · ${counts.draft} draft · ${counts.sent} sent · ${counts.negotiating} in negotiation · ${counts.converted} converted`}
        actions={
          <div className="flex items-center gap-2">
            <ExpireStaleButton />
            <Link href="/quotes/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New quote
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Open pipeline"
          value={formatINR(openPipelineValue)}
          sub="Excl. converted / lost"
        />
        <StatCard label="Sent" value={counts.sent} sub="Awaiting client" />
        <StatCard label="In negotiation" value={counts.negotiating} sub="Action needed" />
        <StatCard label="Converted" value={counts.converted} sub="Became projects" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search quote no, title, or client…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status) && (
          <span className="text-[11px] text-slate-500">
            {quotes.length} quote{quotes.length === 1 ? "" : "s"} match
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Quote #</th>
              <th className="px-2 py-2.5">Title</th>
              <th className="px-2 py-2.5">Client</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Valid until</th>
              <th className="px-2 py-2.5">Created</th>
              <th className="px-5 py-2.5 text-right">Grand total</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  No quotes yet.{" "}
                  <Link href="/quotes/new" className="text-brand hover:underline">
                    Create the first one
                  </Link>
                </td>
              </tr>
            )}
            {quotes.map((q) => (
              <tr
                key={q.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/quotes/${q.id}`}
                    className="font-mono text-[11px] font-medium text-brand hover:underline"
                  >
                    {q.quoteNo}
                  </Link>
                  {q.version > 1 && (
                    <span className="ml-1 text-[10px] text-slate-500">
                      v{q.version}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-slate-900">{q.title}</td>
                <td className="px-2 py-3 text-slate-700">{q.client.name}</td>
                <td className="px-2 py-3">
                  <QuoteStatusPill status={q.status} />
                </td>
                <td className="px-2 py-3 text-[11px] text-slate-600">
                  {q.validUntil
                    ? formatIST(q.validUntil, "dd-MM-yyyy")
                    : "—"}
                </td>
                <td className="px-2 py-3 text-[11px] text-slate-600">
                  {formatIST(q.createdAt, "dd-MM-yyyy")}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                  {formatINR(q.grandTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {quotes.length >= 200 && totalQuoteCount > quotes.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing the 200 most recent quotes ({totalQuoteCount} total). Refine search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
