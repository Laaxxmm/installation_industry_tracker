import { notFound } from "next/navigation";
import {
  AMCStatus,
  Role,
  ServiceCoverage,
  ServicePriority,
  ServiceStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { hasRole, requireSession } from "@/server/rbac";
import {
  assignServiceIssue,
  closeServiceIssue,
  holdServiceIssue,
  resolveServiceIssue,
  resumeServiceIssue,
  startServiceIssue,
  triageServiceIssue,
  verifyServiceIssue,
} from "@/server/actions/service-issues";
import { billServiceIssue } from "@/server/actions/service-billing";
import { Code, KPI, PageHeader, Pill, fmtDate, inr } from "@/components/sab";
import { deriveCoverage } from "@/lib/service-coverage";
import { applyHoldOffset } from "@/lib/sla";
import { ServiceIssueActions } from "../ServiceIssueActions";

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

type PartLine = { sku?: string; description: string; qty: string | number; unit: string };

function fmtRemaining(dueAt: Date | null, holdMinutes: number, now: Date): string {
  if (!dueAt) return "—";
  const effective = applyHoldOffset(dueAt, holdMinutes);
  const deltaMin = Math.round((effective.getTime() - now.getTime()) / (60 * 1000));
  if (deltaMin < 0) return `${Math.abs(deltaMin)} min overdue`;
  if (deltaMin < 60) return `${deltaMin} min left`;
  const hours = Math.floor(deltaMin / 60);
  const mins = deltaMin % 60;
  if (hours < 24) return `${hours}h ${mins}m left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

export default async function ServiceIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canManage = hasRole(session, [Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const { id } = await params;

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    include: {
      client: true,
      project: { select: { name: true } },
      amc: { include: { slas: true } },
      assignedTo: { select: { name: true } },
      triagedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      visits: {
        orderBy: { createdAt: "desc" },
        include: { assignedTo: { select: { name: true } } },
      },
      invoice: true,
    },
  });
  if (!issue) notFound();

  const assignees = canManage
    ? await db.user.findMany({
        where: { active: true, role: { in: [Role.SUPERVISOR, Role.EMPLOYEE] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  // Auto-derived coverage for triage-panel suggestion.
  const suggestedCoverage = deriveCoverage({
    reportedAt: issue.reportedAt,
    amc:
      issue.amc && issue.amc.status === AMCStatus.ACTIVE
        ? { status: issue.amc.status, startDate: issue.amc.startDate, endDate: issue.amc.endDate }
        : null,
    project: null,
  });

  const now = new Date();
  const responseRemaining = fmtRemaining(
    issue.responseDueAt,
    issue.onHoldCumulativeMinutes,
    now,
  );
  const resolutionRemaining = fmtRemaining(
    issue.resolutionDueAt,
    issue.onHoldCumulativeMinutes,
    now,
  );

  async function handleTriage(iid: string, raw: unknown) {
    "use server";
    await triageServiceIssue(iid, raw);
  }
  async function handleAssign(iid: string, userId: string) {
    "use server";
    await assignServiceIssue(iid, userId);
  }
  async function handleStart(iid: string) {
    "use server";
    await startServiceIssue(iid);
  }
  async function handleHold(iid: string, reason: string) {
    "use server";
    await holdServiceIssue(iid, reason);
  }
  async function handleResume(iid: string) {
    "use server";
    await resumeServiceIssue(iid);
  }
  async function handleResolve(iid: string) {
    "use server";
    await resolveServiceIssue(iid);
  }
  async function handleVerify(iid: string, name: string) {
    "use server";
    await verifyServiceIssue(iid, { clientSignoffName: name });
  }
  async function handleClose(iid: string, raw: unknown) {
    "use server";
    await closeServiceIssue(iid, raw);
  }
  async function handleBill(iid: string) {
    "use server";
    await billServiceIssue(iid);
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${issue.ticketNo} · ${issue.channel}`}
        title={issue.summary}
        description={`${issue.client.name} · ${issue.project.name}`}
        actions={
          <div className="flex gap-2 items-center">
            <Pill tone={PRIORITY_TONE[issue.priority]}>{issue.priority}</Pill>
            <Pill tone={STATUS_TONE[issue.status]}>{issue.status}</Pill>
            <Pill tone={COVERAGE_TONE[issue.coverage]}>{issue.coverage}</Pill>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <KPI label="Response SLA" value={responseRemaining} sub={issue.firstResponseAt ? "Responded" : "Clock running"} />
        <KPI
          label="Resolution SLA"
          value={resolutionRemaining}
          sub={issue.slaBreachedAt ? "BREACHED" : "On track"}
          accent={issue.slaBreachedAt !== null}
        />
        <KPI label="On hold (cumulative)" value={`${issue.onHoldCumulativeMinutes} min`} sub="Clock frozen time" />
        <KPI label="Visits" value={issue.visits.length} sub="Logged so far" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-6">
          <section
            className="rounded border p-4 grid gap-2 text-[13px]"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <Row label="Reported">
              {fmtDate(issue.reportedAt)} by {issue.reportedByName}
              {issue.reportedByPhone && ` · ${issue.reportedByPhone}`}
            </Row>
            <Row label="Site">{issue.siteAddress}</Row>
            {issue.description && <Row label="Description">{issue.description}</Row>}
            {issue.amc && (
              <Row label="AMC">
                <Code>{issue.amc.contractNo}</Code> — {issue.amc.title}
              </Row>
            )}
            {issue.assignedTo && <Row label="Assignee">{issue.assignedTo.name}</Row>}
            {issue.triagedBy && (
              <Row label="Triaged by">
                {issue.triagedBy.name}
                {issue.triagedAt ? ` · ${fmtDate(issue.triagedAt)}` : ""}
              </Row>
            )}
            {issue.coverageOverrideReason && (
              <Row label="Override reason">{issue.coverageOverrideReason}</Row>
            )}
          </section>

          <section
            className="rounded border p-4"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
          >
            <h3 className="text-sm font-semibold mb-2">Visit log</h3>
            {issue.visits.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--sab-ink3)" }}>
                No visits logged yet.
              </p>
            ) : (
              <ul className="grid gap-3">
                {issue.visits.map((v) => {
                  const parts = (v.partsUsed as unknown as PartLine[] | null) ?? [];
                  return (
                    <li
                      key={v.id}
                      className="border-l-2 pl-3"
                      style={{ borderColor: "hsl(var(--primary))" }}
                    >
                      <div className="text-[11px] sab-code" style={{ color: "var(--sab-ink3)" }}>
                        {v.arrivedAt ? fmtDate(v.arrivedAt) : fmtDate(v.createdAt)}
                        {v.assignedTo && ` · ${v.assignedTo.name}`}
                      </div>
                      {v.workPerformed && <div className="text-[13px] mt-1">{v.workPerformed}</div>}
                      {v.findings && (
                        <div className="text-[12px] mt-1" style={{ color: "var(--sab-ink2)" }}>
                          Findings: {v.findings}
                        </div>
                      )}
                      {parts.length > 0 && (
                        <div className="text-[11px] mt-1" style={{ color: "var(--sab-ink3)" }}>
                          Parts: {parts.map((p) => `${p.qty} ${p.unit} ${p.description}`).join(", ")}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {issue.coverage === "BILLABLE" && issue.invoice && (
            <section
              className="rounded border p-4 text-[13px]"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
            >
              <h3 className="text-sm font-semibold mb-2">Billing</h3>
              <Row label="Invoice">
                <Code>{issue.invoice.invoiceNo}</Code> · {issue.invoice.status}
              </Row>
              <Row label="Grand total">{inr(Number(issue.invoice.grandTotal))}</Row>
              {issue.billableAmount && (
                <Row label="Ticket billable">{inr(Number(issue.billableAmount))}</Row>
              )}
            </section>
          )}
        </div>

        <aside className="grid gap-4">
          {canManage && (
            <section
              className="rounded border p-4"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
            >
              <h3 className="text-sm font-semibold mb-2">Actions</h3>
              <ServiceIssueActions
                issueId={issue.id}
                status={issue.status}
                priority={issue.priority}
                category={issue.category}
                coverage={issue.coverage}
                suggestedCoverage={suggestedCoverage}
                assignees={assignees}
                onTriage={handleTriage}
                onAssign={handleAssign}
                onStart={handleStart}
                onHold={handleHold}
                onResume={handleResume}
                onResolve={handleResolve}
                onVerify={handleVerify}
                onClose={handleClose}
                onBill={handleBill}
              />
            </section>
          )}

          {issue.amc && (
            <section
              className="rounded border p-4"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
            >
              <h3 className="text-sm font-semibold mb-2">AMC SLA</h3>
              <table className="w-full text-[12px]">
                <tbody>
                  {issue.amc.slas.map((s) => (
                    <tr key={s.priority}>
                      <td className="font-mono py-1">{s.priority}</td>
                      <td className="py-1" style={{ color: "var(--sab-ink2)" }}>
                        {s.responseHours}h / {s.resolutionHours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 10 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
