import { notFound } from "next/navigation";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { formatINR } from "@/lib/money";
import { formatIST } from "@/lib/time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { OverheadForm } from "./OverheadForm";
import { InvoiceForm } from "./InvoiceForm";

export default async function OverheadPage() {
  const session = await requireSession();
  if (!hasRole(session, [Role.ADMIN, Role.MANAGER])) notFound();

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [projects, recentOverheads, recentInvoices, ytdOverhead, ytdInvoices] =
    await Promise.all([
      db.project.findMany({
        where: { status: { in: ["ACTIVE", "DRAFT", "ON_HOLD"] } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      db.overheadAllocation.findMany({
        orderBy: { periodMonth: "desc" },
        take: 25,
        include: { project: { select: { code: true, name: true } } },
      }),
      db.invoice.findMany({
        orderBy: { issuedAt: "desc" },
        take: 25,
        include: { project: { select: { code: true, name: true } } },
      }),
      db.overheadAllocation.aggregate({
        where: { periodMonth: { gte: yearStart } },
        _sum: { amount: true },
      }),
      db.invoice.aggregate({
        where: { issuedAt: { gte: yearStart } },
        _sum: { amount: true },
      }),
    ]);

  const ytdOverheadTotal = ytdOverhead._sum.amount ?? 0;
  const ytdInvoiceTotal = ytdInvoices._sum.amount ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Overhead & revenue"
        description="Manually allocate monthly overhead per project, and book customer invoices that recognise revenue."
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overhead YTD"
          value={formatINR(ytdOverheadTotal)}
          sub={`${new Date().getFullYear()} calendar year`}
        />
        <StatCard
          label="Invoiced revenue YTD"
          value={formatINR(ytdInvoiceTotal)}
          deltaDirection="up"
          sub="Recognised on issue date"
        />
        <StatCard
          label="Overhead entries"
          value={recentOverheads.length}
          sub="Last 25 shown"
        />
        <StatCard
          label="Invoices booked"
          value={recentInvoices.length}
          sub="Last 25 shown"
        />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocate overhead</CardTitle>
            <CardDescription>
              One amount per (project, month). Counts against net P&amp;L in
              that month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OverheadForm projects={projects} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Book invoice</CardTitle>
            <CardDescription>
              Revenue recognised on the issue date, used for P&amp;L revenue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceForm projects={projects} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent overhead</CardTitle>
            <CardDescription>Last 25 allocations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Month</th>
                  <th className="px-2 py-2.5">Project</th>
                  <th className="px-2 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {recentOverheads.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No overhead allocated yet.
                    </td>
                  </tr>
                )}
                {recentOverheads.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-700">
                      {formatIST(o.periodMonth, "yyyy-MM")}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-mono text-[11px] font-medium text-brand">
                        {o.project.code}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {o.project.name}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(o.amount)}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-slate-600">
                      {o.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
            <CardDescription>Last 25 revenue events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2.5">Issued</th>
                  <th className="px-2 py-2.5">Project</th>
                  <th className="px-2 py-2.5">Invoice #</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-8 text-center text-[12px] text-slate-500"
                    >
                      No invoices booked yet.
                    </td>
                  </tr>
                )}
                {recentInvoices.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-700">
                      {formatIST(i.issuedAt, "dd-MM-yyyy")}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-mono text-[11px] font-medium text-brand">
                        {i.project.code}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        {i.project.name}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-slate-600">
                      {i.invoiceNo}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatINR(i.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
