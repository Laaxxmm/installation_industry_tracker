import Link from "next/link";
import { Plus } from "lucide-react";
import { InvoiceStatus, Prisma, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { istFyLabel, istFyStart, istFyEnd } from "@/lib/time";
import { InvoicesTable, type InvoiceRow } from "./InvoicesTable";
import { InvoicesFyFilter } from "./InvoicesFyFilter";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

function parseFyLabelToYear(label: string): number | null {
  const m = label.match(/^FY\s+(\d{2})-(\d{2})$/);
  if (!m) return null;
  return 2000 + Number.parseInt(m[1], 10);
}

export default async function InvoicesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ fyLabel?: string; q?: string; status?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const selectedFyYear = sp.fyLabel ? parseFyLabelToYear(sp.fyLabel) : null;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";

  const now = new Date();
  const currentFyYear = istFyStart(now).getUTCFullYear();

  const scopeRange = selectedFyYear
    ? {
        from: istFyStart(new Date(selectedFyYear, 5, 1)),
        to: istFyEnd(new Date(selectedFyYear, 5, 1)),
      }
    : null;
  const scopeLabel = selectedFyYear
    ? istFyLabel(new Date(selectedFyYear, 5, 1))
    : "all-time";
  const currentFyLabel = sp.fyLabel ?? "";

  const issuedAtScope = scopeRange
    ? { issuedAt: { gte: scopeRange.from, lt: scopeRange.to } }
    : {};

  const [
    invoices,
    statusGroups,
    billedAgg,
    outstandingAgg,
    paidAgg,
    totalInvoiceCount,
    allTimeIssuedCount,
    oldestInvoiceAgg,
  ] = await Promise.all([
    db.clientInvoice.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { invoiceNo: { contains: q, mode: "insensitive" as const } },
                { client: { name: { contains: q, mode: "insensitive" as const } } },
                { project: { code: { contains: q, mode: "insensitive" as const } } },
                { project: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
        ...(status ? { status: status as InvoiceStatus } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 500,
      include: {
        client: { select: { name: true } },
        project: { select: { code: true, name: true } },
      },
    }),
    db.clientInvoice.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.clientInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        ...issuedAtScope,
      },
      _sum: { grandTotal: true },
      _count: { _all: true },
    }),
    db.clientInvoice.aggregate({
      where: { status: InvoiceStatus.ISSUED, ...issuedAtScope },
      _sum: { grandTotal: true, amountPaid: true },
      _count: { _all: true },
    }),
    db.clientInvoice.aggregate({
      where: { status: InvoiceStatus.PAID, ...issuedAtScope },
      _count: { _all: true },
    }),
    db.clientInvoice.count(),
    db.clientInvoice.count({
      where: { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] } },
    }),
    db.clientInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
        issuedAt: { not: null },
      },
      _min: { issuedAt: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all]),
  ) as Record<InvoiceStatus, number>;
  const draftTotal = countByStatus[InvoiceStatus.DRAFT] ?? 0;

  const billed = billedAgg._sum.grandTotal ?? new Prisma.Decimal(0);
  const billedCount = billedAgg._count._all;
  const outstanding = (outstandingAgg._sum.grandTotal ?? new Prisma.Decimal(0)).minus(
    outstandingAgg._sum.amountPaid ?? new Prisma.Decimal(0),
  );
  const outstandingCount = outstandingAgg._count._all;
  const paidCount = paidAgg._count._all;

  const oldestIssuedAt = oldestInvoiceAgg._min.issuedAt ?? null;
  const oldestFyYear = oldestIssuedAt
    ? istFyStart(oldestIssuedAt).getUTCFullYear()
    : currentFyYear;
  const fyOptions: string[] = [];
  for (let y = currentFyYear; y >= oldestFyYear; y--) {
    fyOptions.push(istFyLabel(new Date(y, 5, 1)));
  }

  const billedLabel =
    scopeLabel === "all-time" ? "Billed · all-time" : `Billed · ${scopeLabel}`;
  const billedSub = selectedFyYear
    ? `${billedCount} invoices in ${scopeLabel} · ${allTimeIssuedCount} all-time issued`
    : `${allTimeIssuedCount} invoices issued`;
  const outstandingSub = selectedFyYear
    ? `${outstandingCount} awaiting payment · ${scopeLabel}`
    : `${outstandingCount} awaiting payment`;
  const paidSub = selectedFyYear ? `fully settled · ${scopeLabel}` : "fully settled";

  const rows: InvoiceRow[] = invoices.map((i) => ({
    id: i.id,
    invoiceNo: i.invoiceNo,
    kind: i.kind,
    status: i.status,
    clientName: i.client.name,
    projectCode: i.project.code,
    projectName: i.project.name,
    issuedAt: i.issuedAt ? i.issuedAt.toISOString() : null,
    fy: i.issuedAt ? istFyLabel(i.issuedAt) : null,
    grandTotal: i.grandTotal.toString(),
    amountPaid: i.amountPaid.toString(),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Client invoices"
        description="GST-compliant tax invoices per project"
        actions={
          <>
            <InvoicesFyFilter options={fyOptions} current={currentFyLabel} />
            <Link href="/invoices/new">
              <Button>
                <Plus className="h-4 w-4" /> New invoice
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href={
            selectedFyYear
              ? `/invoices?fyLabel=${encodeURIComponent(scopeLabel)}&statusIn=ISSUED,PAID`
              : "/invoices?statusIn=ISSUED,PAID"
          }
          scroll={false}
          className="block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <StatCard
            label={billedLabel}
            value={formatINR(billed)}
            sub={billedSub}
          />
        </Link>
        <Link
          href={
            selectedFyYear
              ? `/invoices?fyLabel=${encodeURIComponent(scopeLabel)}&status=ISSUED`
              : "/invoices?status=ISSUED"
          }
          scroll={false}
          className="block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <StatCard
            label="Outstanding"
            value={formatINR(outstanding)}
            sub={outstandingSub}
          />
        </Link>
        <Link
          href={
            selectedFyYear
              ? `/invoices?fyLabel=${encodeURIComponent(scopeLabel)}&status=PAID`
              : "/invoices?status=PAID"
          }
          scroll={false}
          className="block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <StatCard label="Paid" value={paidCount} sub={paidSub} />
        </Link>
        <Link
          href="/invoices?status=DRAFT"
          scroll={false}
          className="block rounded-md transition hover:ring-2 hover:ring-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <StatCard label="Drafts" value={draftTotal} sub="not yet issued" />
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search invoice no, client, or project…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status) && (
          <span className="text-[11px] text-slate-500">
            {rows.length} of {totalInvoiceCount} invoice{totalInvoiceCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <InvoicesTable rows={rows} />
      {rows.length >= 500 && totalInvoiceCount > rows.length && (
        <div className="mt-2 text-center text-[11px] text-slate-500">
          Showing the 500 most recent invoices ({totalInvoiceCount} total).
        </div>
      )}
    </div>
  );
}
