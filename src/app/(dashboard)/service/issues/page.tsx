import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, ServiceCoverage, ServicePriority, ServiceStatus } from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { Code, PageHeader, Pill, fmtDate } from "@/components/sab";

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

export default async function ServiceIssuesPage() {
  const session = await requireSession();
  const canCreate = hasRole(session, [
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const issues = await db.serviceIssue.findMany({
    orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
    take: 300,
    include: {
      client: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

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
      </div>
    </div>
  );
}
