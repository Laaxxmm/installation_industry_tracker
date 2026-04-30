import Link from "next/link";
import { Plus } from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { requireSession, hasRole } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableSearchInput } from "@/components/sab/TableFilters";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [Role.ADMIN, Role.MANAGER]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { gstin: { contains: q, mode: "insensitive" as const } },
          { contactName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  // Capped list of clients + counts in one round-trip. Total client directories
  // rarely exceed a couple hundred rows, but the _count subqueries multiply
  // every row into 3 count queries — so cap at 200 to keep the query bounded.
  const [clients, totalCount, activeCount, withGstin] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: 200,
      include: {
        _count: {
          select: { projects: true, quotes: true, clientInvoices: true },
        },
      },
    }),
    db.client.count(),
    db.client.count({ where: { active: true } }),
    db.client.count({ where: { gstin: { not: null } } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Clients"
        description={`${totalCount} total · ${activeCount} active · ${withGstin} with GSTIN`}
        actions={
          canCreate ? (
            <Link href="/clients/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New client
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Clients" value={totalCount} sub={`${activeCount} active`} />
        <StatCard label="GST registered" value={withGstin} sub="with GSTIN" />
        <StatCard
          label="Projects linked"
          value={clients.reduce((a, c) => a + c._count.projects, 0)}
          sub="across all clients"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search name, GSTIN, or contact…"
          width={280}
        />
        {q && (
          <span className="text-[11px] text-slate-500">
            {clients.length} of {totalCount} client{totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5">Name</th>
              <th className="px-2 py-2.5">GSTIN</th>
              <th className="px-2 py-2.5">State</th>
              <th className="px-2 py-2.5">Contact</th>
              <th className="px-2 py-2.5 text-right">Projects</th>
              <th className="px-2 py-2.5 text-right">Quotes</th>
              <th className="px-5 py-2.5 text-right">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-[13px] text-slate-500"
                >
                  No clients yet.{" "}
                  {canCreate && (
                    <Link href="/clients/new" className="text-brand hover:underline">
                      Create the first one
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {c.name}
                  </Link>
                  {!c.active && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Archived
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 font-mono text-[11px] text-slate-700">
                  {c.gstin ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-2 py-3 text-slate-700">{c.stateCode}</td>
                <td className="px-2 py-3 text-slate-700">
                  {c.contactName ?? c.email ?? c.phone ?? (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                  {c._count.projects}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-slate-900">
                  {c._count.quotes}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                  {c._count.clientInvoices}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length >= 200 && totalCount > clients.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing 200 of {totalCount} clients.
          </div>
        )}
      </div>
    </div>
  );
}
