import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ServiceCoverage,
  ServicePriority,
  ServiceStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireSession } from "@/server/rbac";
import { logServiceVisit } from "@/server/actions/service-visits";
import {
  resolveServiceIssue,
  startServiceIssue,
} from "@/server/actions/service-issues";
import { formatIST } from "@/lib/time";
import { applyHoldOffset } from "@/lib/sla";
import { Code } from "@/components/sab/Code";
import { Pill } from "@/components/sab";
import { MobileServiceVisitForm } from "./MobileServiceVisitForm";

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
  if (deltaMin < 0) return `${Math.abs(deltaMin)}m overdue`;
  if (deltaMin < 60) return `${deltaMin}m left`;
  const hours = Math.floor(deltaMin / 60);
  const mins = deltaMin % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default async function MobileServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true } },
      amc: { select: { contractNo: true, title: true } },
      visits: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { assignedTo: { select: { name: true } } },
      },
    },
  });
  if (!issue) notFound();

  const canStart =
    issue.status === ServiceStatus.ASSIGNED || issue.status === ServiceStatus.TRIAGED;
  const canResolve =
    issue.status === ServiceStatus.IN_PROGRESS ||
    issue.status === ServiceStatus.ASSIGNED;

  async function onStart(iid: string) {
    "use server";
    await startServiceIssue(iid);
  }
  async function onLogVisit(iid: string, raw: unknown) {
    "use server";
    await logServiceVisit(iid, raw);
  }
  async function onResolve(iid: string) {
    "use server";
    await resolveServiceIssue(iid);
  }

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

  const terminal =
    issue.status === ServiceStatus.CLOSED ||
    issue.status === ServiceStatus.CANCELLED ||
    issue.status === ServiceStatus.RESOLVED ||
    issue.status === ServiceStatus.VERIFIED;

  return (
    <div className="pb-6">
      <div className="px-5 pb-3 pt-4">
        <Link
          href="/mobile/service"
          className="font-sab-mono text-[11px]"
          style={{ color: "var(--sab-ink3)", textDecoration: "none" }}
        >
          ← Back to queue
        </Link>

        <div className="mt-2 flex items-center gap-1.5">
          <Pill tone={PRIORITY_TONE[issue.priority]} size="sm">
            {issue.priority}
          </Pill>
          <Pill tone={COVERAGE_TONE[issue.coverage]} size="sm">
            {issue.coverage}
          </Pill>
          <Pill tone={STATUS_TONE[issue.status]} size="sm">
            {issue.status}
          </Pill>
        </div>

        <h1 className="mt-2 font-sab-sans text-[18px] font-semibold leading-snug tracking-[-0.02em]">
          {issue.summary}
        </h1>
        <div
          className="font-sab-mono text-[10.5px] mt-1"
          style={{ color: "var(--sab-ink3)" }}
        >
          <Code>{issue.ticketNo}</Code>
          {issue.amc && (
            <>
              {" · "}
              <Code>{issue.amc.contractNo}</Code>
            </>
          )}
        </div>

        <div
          className="mt-2 font-sab-sans text-[12px]"
          style={{ color: "var(--sab-ink2)" }}
        >
          {issue.client.name} · {issue.project.name}
        </div>
        <div
          className="mt-0.5 font-sab-sans text-[12px]"
          style={{ color: "var(--sab-ink3)" }}
        >
          {issue.siteAddress}
        </div>

        {issue.description && (
          <div
            className="mt-2 rounded border px-2 py-1.5 font-sab-sans text-[12.5px]"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "var(--sab-ink)",
            }}
          >
            {issue.description}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="rounded border px-2 py-1.5"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 9 }}>
              Response SLA
            </div>
            <div className="font-sab-mono text-[13px] mt-0.5">{responseRemaining}</div>
          </div>
          <div
            className="rounded border px-2 py-1.5"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            <div className="sab-caps" style={{ color: "var(--sab-ink3)", fontSize: 9 }}>
              Resolution
            </div>
            <div
              className="font-sab-mono text-[13px] mt-0.5"
              style={{ color: issue.slaBreachedAt ? "hsl(var(--destructive))" : undefined }}
            >
              {issue.slaBreachedAt ? "BREACHED" : resolutionRemaining}
            </div>
          </div>
        </div>

        {issue.reportedByPhone && (
          <a
            href={`tel:${issue.reportedByPhone}`}
            className="mt-3 block rounded border px-3 py-2 font-sab-mono text-[12.5px] text-center"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
              color: "hsl(var(--primary))",
              textDecoration: "none",
            }}
          >
            📞 Call {issue.reportedByName} · {issue.reportedByPhone}
          </a>
        )}
      </div>

      <div className="px-4">
        {terminal ? (
          <div
            className="rounded border p-4 text-[13px]"
            style={{
              borderColor: "hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
          >
            <div className="font-semibold mb-1">Ticket {issue.status.toLowerCase()}</div>
            <p style={{ color: "var(--sab-ink2)" }}>
              No further visits can be logged from mobile. See desktop to verify, close, or bill.
            </p>
          </div>
        ) : (
          <MobileServiceVisitForm
            serviceIssueId={issue.id}
            canStart={canStart}
            canResolve={canResolve}
            onStart={onStart}
            onLogVisit={onLogVisit}
            onResolve={onResolve}
          />
        )}
      </div>

      {issue.visits.length > 0 && (
        <div className="px-4 mt-5">
          <div className="sab-caps mb-2" style={{ color: "var(--sab-ink3)", fontSize: 10 }}>
            Recent visits
          </div>
          <ul className="grid gap-2">
            {issue.visits.map((v) => {
              const parts = (v.partsUsed as unknown as PartLine[] | null) ?? [];
              return (
                <li
                  key={v.id}
                  className="rounded border px-2 py-1.5"
                  style={{
                    borderColor: "hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                >
                  <div
                    className="font-sab-mono text-[10.5px]"
                    style={{ color: "var(--sab-ink3)" }}
                  >
                    {formatIST(v.arrivedAt ?? v.createdAt, "dd MMM HH:mm")}
                    {v.assignedTo && ` · ${v.assignedTo.name}`}
                  </div>
                  {v.workPerformed && (
                    <div className="font-sab-sans text-[12.5px] mt-0.5">
                      {v.workPerformed}
                    </div>
                  )}
                  {parts.length > 0 && (
                    <div
                      className="font-sab-sans text-[11px] mt-0.5"
                      style={{ color: "var(--sab-ink3)" }}
                    >
                      Parts: {parts.map((p) => `${p.qty} ${p.unit} ${p.description}`).join(", ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
