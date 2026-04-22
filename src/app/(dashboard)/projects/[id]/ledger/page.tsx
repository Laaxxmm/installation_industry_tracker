import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { InvoiceStatus, Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { formatINR, toDecimal } from "@/lib/money";
import { formatIST } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ProjectTabs } from "../ProjectTabs";

type LedgerKind =
  | "Invoice"
  | "Tax invoice"
  | "Stock issue"
  | "Direct purchase"
  | "Overhead"
  | "Transfer in"
  | "Transfer out";

type LedgerRow = {
  when: Date;
  kind: LedgerKind;
  description: string;
  amount: string;
  positive: boolean;
  href?: string;
};

const KIND_STYLES: Record<LedgerKind, string> = {
  Invoice: "bg-emerald-50 text-emerald-800",
  "Tax invoice": "bg-emerald-100 text-emerald-900",
  "Stock issue": "bg-sky-50 text-sky-800",
  "Direct purchase": "bg-amber-50 text-amber-800",
  Overhead: "bg-slate-100 text-slate-700",
  "Transfer in": "bg-indigo-50 text-indigo-800",
  "Transfer out": "bg-violet-50 text-violet-800",
};

export default async function ProjectLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  if (!hasRole(session, [Role.ADMIN, Role.MANAGER])) {
    notFound();
  }

  // Ledger was a single mega-query with 7 child relations pulling full records.
  // Split into parallel slim selects, capped per relation so a busy project
  // doesn't drag thousands of rows into memory just to render a page.
  const projectMeta = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      clientId: true,
    },
  });
  if (!projectMeta) notFound();

  const [
    invoices,
    clientInvoices,
    stockIssues,
    directPurchases,
    overheadAllocs,
    transfersIn,
    transfersOut,
  ] = await Promise.all([
    db.invoice.findMany({
      where: { projectId: id },
      orderBy: { issuedAt: "desc" },
      take: 300,
    }),
    db.clientInvoice.findMany({
      where: {
        projectId: id,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
      },
      orderBy: { issuedAt: "desc" },
      take: 300,
      select: {
        id: true,
        invoiceNo: true,
        kind: true,
        status: true,
        issuedAt: true,
        grandTotal: true,
      },
    }),
    db.stockIssue.findMany({
      where: { projectId: id },
      orderBy: { issuedAt: "desc" },
      take: 500,
      select: {
        id: true,
        qty: true,
        unitCostAtIssue: true,
        issuedAt: true,
        material: { select: { sku: true, unit: true } },
      },
    }),
    db.directPurchase.findMany({
      where: { projectId: id },
      orderBy: { purchasedAt: "desc" },
      take: 500,
    }),
    db.overheadAllocation.findMany({
      where: { projectId: id },
      orderBy: { periodMonth: "desc" },
      take: 300,
    }),
    db.materialTransfer.findMany({
      where: { toProjectId: id },
      orderBy: { transferredAt: "desc" },
      take: 200,
      select: {
        id: true,
        qty: true,
        unitCostAtTransfer: true,
        transferredAt: true,
        material: { select: { sku: true, unit: true } },
        fromProject: { select: { code: true } },
      },
    }),
    db.materialTransfer.findMany({
      where: { fromProjectId: id },
      orderBy: { transferredAt: "desc" },
      take: 200,
      select: {
        id: true,
        qty: true,
        unitCostAtTransfer: true,
        transferredAt: true,
        material: { select: { sku: true, unit: true } },
        toProject: { select: { code: true } },
      },
    }),
  ]);
  const project = {
    ...projectMeta,
    invoices,
    clientInvoices,
    stockIssues,
    directPurchases,
    overheadAllocs,
    transfersIn,
    transfersOut,
  };

  const rows: LedgerRow[] = [];

  for (const inv of project.invoices) {
    rows.push({
      when: inv.issuedAt,
      kind: "Invoice",
      description: `${inv.invoiceNo}${inv.note ? ` — ${inv.note}` : ""}`,
      amount: formatINR(inv.amount),
      positive: true,
    });
  }
  for (const inv of project.clientInvoices) {
    if (!inv.issuedAt) continue;
    const paidTag =
      inv.status === InvoiceStatus.PAID ? " · paid" : " · awaiting payment";
    rows.push({
      when: inv.issuedAt,
      kind: "Tax invoice",
      description: `${inv.invoiceNo} · ${inv.kind}${paidTag}`,
      amount: formatINR(inv.grandTotal),
      positive: true,
      href: `/invoices/${inv.id}`,
    });
  }
  for (const si of project.stockIssues) {
    const total = toDecimal(si.qty).times(toDecimal(si.unitCostAtIssue));
    rows.push({
      when: si.issuedAt,
      kind: "Stock issue",
      description: `${si.material.sku} — ${si.qty.toString()} ${si.material.unit}`,
      amount: "(" + formatINR(total) + ")",
      positive: false,
    });
  }
  for (const dp of project.directPurchases) {
    rows.push({
      when: dp.purchasedAt,
      kind: "Direct purchase",
      description: `${dp.description} [${dp.category}]${dp.supplier ? ` — ${dp.supplier}` : ""}`,
      amount: "(" + formatINR(dp.total) + ")",
      positive: false,
    });
  }
  for (const oh of project.overheadAllocs) {
    rows.push({
      when: oh.periodMonth,
      kind: "Overhead",
      description: `${formatIST(oh.periodMonth, "yyyy-MM")}${oh.note ? ` — ${oh.note}` : ""}`,
      amount: "(" + formatINR(oh.amount) + ")",
      positive: false,
    });
  }
  for (const t of project.transfersIn) {
    const total = toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer));
    rows.push({
      when: t.transferredAt,
      kind: "Transfer in",
      description: `${t.material.sku} — ${t.qty.toString()} ${t.material.unit} from ${t.fromProject.code}`,
      amount: "(" + formatINR(total) + ")",
      positive: false,
    });
  }
  for (const t of project.transfersOut) {
    const total = toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer));
    rows.push({
      when: t.transferredAt,
      kind: "Transfer out",
      description: `${t.material.sku} — ${t.qty.toString()} ${t.material.unit} to ${t.toProject.code}`,
      amount: formatINR(total),
      positive: true,
    });
  }

  rows.sort((a, b) => b.when.getTime() - a.when.getTime());

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
        title="Ledger"
        description={`${rows.length} transactions · revenue, materials, purchases, overhead, transfers`}
        actions={
          project.clientId ? (
            <Link href={`/invoices/new?project=${project.id}`}>
              <Button>
                <FilePlus2 className="h-4 w-4" /> New tax invoice
              </Button>
            </Link>
          ) : (
            <span className="text-[11px] italic text-slate-500">
              Attach a client to enable GST invoicing
            </span>
          )
        }
      />

      <ProjectTabs projectId={id} />

      <div className="mt-5 rounded-md border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="text-[14px] font-semibold text-slate-900">
            All transactions
          </div>
          <div className="text-[11px] text-slate-500">
            Labor is computed from approved time entries — see P&L tab
          </div>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Date</th>
              <th className="px-2 py-2.5">Type</th>
              <th className="px-2 py-2.5">Description</th>
              <th className="px-5 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  No entries yet.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
              >
                <td className="px-5 py-2.5 font-mono text-[11px] text-slate-600">
                  {formatIST(r.when, "dd-MM-yyyy")}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                      KIND_STYLES[r.kind]
                    }
                  >
                    {r.kind}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-slate-800">
                  {r.href ? (
                    <Link href={r.href} className="hover:text-brand hover:underline">
                      {r.description}
                    </Link>
                  ) : (
                    r.description
                  )}
                </td>
                <td
                  className={
                    "px-5 py-2.5 text-right font-mono font-semibold tabular-nums " +
                    (r.positive ? "text-emerald-700" : "text-red-700")
                  }
                >
                  {r.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
