import Link from "next/link";
import { Plus } from "lucide-react";
import { Role, ServiceStatus } from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import { Button } from "@/components/ui/button";
import { Code, KPI, PageHeader, Pill, fmtDate } from "@/components/sab";

const NON_TERMINAL: ServiceStatus[] = [
  ServiceStatus.NEW,
  ServiceStatus.TRIAGED,
  ServiceStatus.ASSIGNED,
  ServiceStatus.IN_PROGRESS,
  ServiceStatus.ON_HOLD,
  ServiceStatus.RESOLVED,
  ServiceStatus.VERIFIED,
];

export default async function ServiceDashboardPage() {
  const session = await requireSession();
  const canCreate = hasRole(session, [
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [openCount, p1Breached, dueToday, resolvedLastWeek, triageQueue] = await Promise.all([
    db.serviceIssue.count({ where: { status: { in: NON_TERMINAL } } }),
    db.serviceIssue.count({
      where: {
        status: { in: NON_TERMINAL },
        priority: "P1",
        slaBreachedAt: { not: null },
      },
    }),
    db.serviceIssue.count({
      where: {
        status: { in: NON_TERMINAL },
        resolutionDueAt: { gte: now, lte: endOfDay },
      },
    }),
    db.serviceIssue.count({
      where: { resolvedAt: { gte: weekAgo } },
    }),
    db.serviceIssue.findMany({
      where: { status: ServiceStatus.NEW },
      orderBy: { reportedAt: "desc" },
      take: 50,
      include: { client: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="After-sales"
        title="Service dashboard"
        description="Triage queue and SLA-at-risk tickets."
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

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Open tickets" value={openCount} sub="All priorities" accent />
        <KPI label="P1 breached" value={p1Breached} sub="Needs escalation" />
        <KPI label="Due today" value={dueToday} sub="Resolve by midnight" />
        <KPI label="Resolved (7d)" value={resolvedLastWeek} sub="Last seven days" />
      </div>

      <section
        className="rounded border p-0 overflow-hidden"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
      >
        <div
          className="px-3 py-2 flex justify-between border-b"
          style={{ borderColor: "hsl(var(--border))", background: "var(--sab-paper-alt)" }}
        >
          <div className="sab-caps text-[10px]" style={{ color: "var(--sab-ink3)" }}>
            Triage queue (NEW)
          </div>
          <Link href="/service/issues" className="text-[11px] underline">
            All tickets →
          </Link>
        </div>
        <table className="w-full text-[12.5px] sab-tabular">
          <thead>
            <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
              {["Ticket", "Client", "Reported", "Channel", "Summary"].map((h) => (
                <th key={h} className="text-left sab-caps px-3 py-2" style={{ color: "var(--sab-ink3)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triageQueue.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center" style={{ color: "var(--sab-ink3)" }}>
                  Nothing waiting. 🎉
                </td>
              </tr>
            )}
            {triageQueue.map((t) => (
              <tr
                key={t.id}
                className="border-b hover:bg-[hsl(var(--secondary))]/60"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <td className="px-3 py-2">
                  <Link href={`/service/issues/${t.id}`} className="underline">
                    <Code>{t.ticketNo}</Code>
                  </Link>
                </td>
                <td className="px-3 py-2" style={{ color: "var(--sab-ink2)" }}>
                  {t.client.name}
                </td>
                <td className="px-3 py-2 sab-code" style={{ fontSize: 11, color: "var(--sab-ink2)" }}>
                  {fmtDate(t.reportedAt)}
                </td>
                <td className="px-3 py-2">
                  <Pill tone="ink" size="sm">
                    {t.channel}
                  </Pill>
                </td>
                <td className="px-3 py-2 text-[12.5px]" style={{ color: "var(--sab-ink)" }}>
                  {t.summary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
