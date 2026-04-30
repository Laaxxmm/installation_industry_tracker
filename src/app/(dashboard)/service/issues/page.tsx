import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, ServiceCoverage, ServicePriority, ServiceStatus } from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { Code, PageHeader, Pill, fmtDate } from "@/components/sab";
import {
  TableSearchInput,
  TableSelectFilter,
} from "@/components/sab/TableFilters";

const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  RESOLVED: "Resolved",
  VERIFIED: "Verified",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PRIORITY_LABELS: Record<ServicePriority, string> = {
  P1: "P1 — Critical",
  P2: "P2 — High",
  P3: "P3 — Normal",
  P4: "P4 — Low",
};

const STATUS_TONE: Record<ServiceStatus, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  NEW: "blue",
  TRIAGED: "blue",
  ASSIGNED: "amber",
  IN_PROGRESS: "amber",
  ON_HOLD: "ink",
  RESOLVED: "positive",
  VERIFIED: "positive",
  CLOSED: "ink",
  CANCELLED: "alert",
};

const PRIORITY_TONE: Record<ServicePriority, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  P1: "alert",
  P2: "amber",
  P3: "blue",
  P4: "ink",
};

const COVERAGE_TONE: Record<ServiceCoverage, "ink" | "accent" | "amber" | "alert" | "positive" | "blue"> = {
  AMC: "accent",
  WARRANTY: "positive",
  GOODWILL: "amber",
  BILLABLE: "ink",
};

export default async function ServiceIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string }>;
}) {
  const session = await requireSession();
  const canCreate = hasRole(session, [
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status?.trim() ?? "";
  const priority = sp.priority?.trim() ?? "";

  const [issues, totalCount] = await Promise.all([
    db.serviceIssue.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { ticketNo: { contains: q, mode: "insensitive" as const } },
                { summary: { contains: q, mode: "insensitive" as const } },
                { client: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
        ...(status ? { status: status as ServiceStatus } : {}),
        ...(priority ? { priority: priority as ServicePriority } : {}),
      },
      orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
      take: 300,
      include: {
        client: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.serviceIssue.count(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="After-sales"
        title="Service tickets"
        description={`${issues.length} tickets across all statuses`}
        actions={
          canCreate ? (
            <Link href="/service/issues/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New ticket
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          current={q}
          placeholder="Search ticket no, summary, or client…"
          width={300}
        />
        <TableSelectFilter
          paramName="status"
          label="Status"
          current={status}
          options={Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <TableSelectFilter
          paramName="priority"
          label="Priority"
          current={priority}
          options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {(q || status || priority) && (
          <span className="text-[11px] text-slate-500">
            {issues.length} of {totalCount} ticket{totalCount === 1 ? "" : "s"}
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
              {["Ticket", "Client", "Priority", "Status", "Coverage", "Reported", "Assignee"].map((h) => (
                <th key={h} className="text-left sab-caps px-3 py-2.5" style={{ color: "var(--sab-ink3)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center" style={{ color: "var(--sab-ink3)" }}>
                  No tickets yet.
                </td>
              </tr>
            )}
            {issues.map((t) => (
              <tr
                key={t.id}
                className="border-b hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2.5">
                  <Link href={`/service/issues/${t.id}`} className="block font-semibold underline">
                    <Code>{t.ticketNo}</Code>
                  </Link>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--sab-ink3)" }}>
                    {t.summary}
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {t.client.name}
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={PRIORITY_TONE[t.priority]} size="sm">
                    {t.priority}
                  </Pill>
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={STATUS_TONE[t.status]} size="sm">
                    {t.status}
                  </Pill>
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone={COVERAGE_TONE[t.coverage]} size="sm">
                    {t.coverage}
                  </Pill>
                </td>
                <td className="px-3 py-2.5 sab-code" style={{ fontSize: 11, color: "var(--sab-ink2)" }}>
                  {fmtDate(t.reportedAt)}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--sab-ink2)" }}>
                  {t.assignedTo?.name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {issues.length >= 300 && totalCount > issues.length && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-2 text-center text-[11px] text-slate-500">
            Showing 300 of {totalCount} tickets. Refine search to see more.
          </div>
        )}
      </div>
    </div>
  );
}
