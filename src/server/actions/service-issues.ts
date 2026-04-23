"use server";

// Service tickets: NEW → TRIAGED → ASSIGNED → IN_PROGRESS → (ON_HOLD)
// → RESOLVED → VERIFIED → CLOSED. Triage is the decision point: it picks
// coverage (AMC / WARRANTY / GOODWILL / BILLABLE), sets priority, and stamps
// SLA deadlines derived from AMC SLA rows or defaults.

import { revalidatePath } from "next/cache";
import {
  AMCStatus,
  Prisma,
  Role,
  ServiceStatus,
} from "@prisma/client";
import { db } from "@/server/db";
import { requireRole } from "@/server/rbac";
import {
  ServiceIssueCloseInput,
  ServiceIssueCreateInput,
  ServiceIssueTriageInput,
} from "@/lib/validators";
import { computeDueDates, minutesBetween } from "@/lib/sla";
import { deriveCoverage, isCoverageOverride } from "@/lib/service-coverage";

const D = Prisma.Decimal;

// Same FY helpers as procurement.ts / amcs.ts.
function fyFor(date = new Date()): number {
  const m = date.getMonth();
  return m >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

function fyLabel(year: number): string {
  return `${pad(year % 100, 2)}-${pad((year + 1) % 100, 2)}`;
}

async function nextServiceTicketNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = fyFor();
  const row = await tx.serviceTicketNumberSequence.upsert({
    where: { year },
    update: { next: { increment: 1 } },
    // Start SR- sequence at 1 (one-off ticket volume is much higher than AMCs).
    create: { year, next: 2 },
  });
  const claimed = Math.max(1, row.next - 1);
  return `SR-${fyLabel(year)}-${pad(claimed, 4)}`;
}

// Terminal statuses are immutable (beyond corrections handled separately).
const TERMINAL_STATUSES: ServiceStatus[] = [
  ServiceStatus.CLOSED,
  ServiceStatus.CANCELLED,
];

/**
 * Intake: any authenticated staff can log an inbound ticket. Status stays NEW
 * until an operator triages — SLA deadlines are NOT set here.
 */
export async function createServiceIssue(raw: unknown) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);
  const input = ServiceIssueCreateInput.parse(raw);

  // Verify client+project consistency if both given.
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { clientId: true },
  });
  if (!project) throw new Error("Project not found");
  if (project.clientId && project.clientId !== input.clientId) {
    throw new Error("Project's client does not match the ticket's client");
  }

  const issue = await db.$transaction(async (tx) => {
    const ticketNo = await nextServiceTicketNo(tx);
    return tx.serviceIssue.create({
      data: {
        ticketNo,
        clientId: input.clientId,
        projectId: input.projectId,
        amcId: input.amcId ?? null,
        reportedAt: new Date(input.reportedAt),
        reportedByName: input.reportedByName,
        reportedByPhone: input.reportedByPhone ?? null,
        channel: input.channel,
        siteAddress: input.siteAddress,
        summary: input.summary,
        description: input.description ?? null,
        attachmentUrls: input.attachmentUrls,
        category: input.category,
        priority: input.priority,
        status: ServiceStatus.NEW,
      },
    });
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entity: "ServiceIssue",
      entityId: issue.id,
    },
  });

  revalidatePath("/service");
  revalidatePath("/service/issues");
  return { issueId: issue.id, ticketNo: issue.ticketNo };
}

/**
 * Triage: pick priority/category, auto-derive coverage (or override with
 * justification), stamp SLA deadlines, optionally assign a technician.
 */
export async function triageServiceIssue(id: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const input = ServiceIssueTriageInput.parse(raw);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    include: {
      amc: {
        include: { slas: true },
      },
      project: { select: { id: true } },
    },
  });
  if (!issue) throw new Error("Ticket not found");
  if (
    issue.status === ServiceStatus.CLOSED ||
    issue.status === ServiceStatus.CANCELLED
  ) {
    throw new Error(`Cannot triage a ${issue.status} ticket`);
  }

  // If the ticket is linked to an AMC that's still active, use its window for
  // coverage derivation. Otherwise fall through to project warranty / billable.
  let amcInput: Parameters<typeof deriveCoverage>[0]["amc"] = null;
  if (issue.amc && issue.amc.status === AMCStatus.ACTIVE) {
    amcInput = {
      status: issue.amc.status,
      startDate: issue.amc.startDate,
      endDate: issue.amc.endDate,
    };
  }

  // Project warranty clock: for now we don't have handoverAt on Project; leave
  // null so coverage derives either from AMC or falls to BILLABLE. When the
  // Project.handoverAt field ships we slot it in here.
  const derivedCoverage = deriveCoverage({
    reportedAt: issue.reportedAt,
    amc: amcInput,
    project: null,
  });

  // Enforce override reasoning.
  if (isCoverageOverride(derivedCoverage, input.coverage) && !input.coverageOverrideReason) {
    throw new Error(
      `Coverage override requires a reason (auto-derived = ${derivedCoverage}, chosen = ${input.coverage})`,
    );
  }

  // SLA deadlines from AMC SLA rows or defaults.
  const amcSlas = issue.amc?.slas ?? null;
  const due = computeDueDates({
    reportedAt: issue.reportedAt,
    priority: input.priority,
    amcSlas,
  });

  const nextStatus =
    input.assignedToUserId ? ServiceStatus.ASSIGNED : ServiceStatus.TRIAGED;

  await db.serviceIssue.update({
    where: { id },
    data: {
      priority: input.priority,
      category: input.category,
      coverage: input.coverage,
      coverageOverrideReason: input.coverageOverrideReason ?? null,
      responseDueAt: due.responseDueAt,
      resolutionDueAt: due.resolutionDueAt,
      assignedToUserId: input.assignedToUserId ?? null,
      status: nextStatus,
      triagedByUserId: session.user.id,
      triagedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "TRIAGE",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath("/service");
  revalidatePath("/service/issues");
  revalidatePath(`/service/issues/${id}`);
}

/** Reassign an already-triaged ticket. */
export async function assignServiceIssue(id: string, userId: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (TERMINAL_STATUSES.includes(issue.status)) {
    throw new Error(`Cannot assign a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      assignedToUserId: userId,
      status: issue.status === ServiceStatus.NEW || issue.status === ServiceStatus.TRIAGED
        ? ServiceStatus.ASSIGNED
        : issue.status,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ASSIGN",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
  revalidatePath(`/mobile/service`);
}

/** Technician taps Start when they arrive on-site. */
export async function startServiceIssue(id: string) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (
    issue.status !== ServiceStatus.ASSIGNED &&
    issue.status !== ServiceStatus.TRIAGED
  ) {
    throw new Error(`Cannot start a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: { status: ServiceStatus.IN_PROGRESS },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "START",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
  revalidatePath(`/mobile/service`);
}

/**
 * Pause the SLA clock. onHoldSince is stamped so the delta can be rolled
 * into onHoldCumulativeMinutes on resume.
 */
export async function holdServiceIssue(id: string, reason: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  if (!reason || reason.trim().length < 3) {
    throw new Error("Reason required to place ticket on hold");
  }

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true, onHoldSince: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (issue.onHoldSince) throw new Error("Ticket is already on hold");
  if (
    issue.status === ServiceStatus.CLOSED ||
    issue.status === ServiceStatus.CANCELLED ||
    issue.status === ServiceStatus.VERIFIED ||
    issue.status === ServiceStatus.RESOLVED
  ) {
    throw new Error(`Cannot hold a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.ON_HOLD,
      onHoldSince: new Date(),
      closureNotes: null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "HOLD",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
}

/**
 * Resume from hold: roll the hold-delta into cumulative minutes, extend the
 * resolutionDueAt to bank the pause, clear onHoldSince.
 */
export async function resumeServiceIssue(id: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: {
      status: true,
      onHoldSince: true,
      onHoldCumulativeMinutes: true,
      responseDueAt: true,
      resolutionDueAt: true,
    },
  });
  if (!issue) throw new Error("Ticket not found");
  if (issue.status !== ServiceStatus.ON_HOLD || !issue.onHoldSince) {
    throw new Error("Ticket is not on hold");
  }

  const now = new Date();
  const held = Math.max(0, minutesBetween(issue.onHoldSince, now));
  const newResponseDue = issue.responseDueAt
    ? new Date(issue.responseDueAt.getTime() + held * 60 * 1000)
    : null;
  const newResolutionDue = issue.resolutionDueAt
    ? new Date(issue.resolutionDueAt.getTime() + held * 60 * 1000)
    : null;

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.IN_PROGRESS,
      onHoldSince: null,
      onHoldCumulativeMinutes: issue.onHoldCumulativeMinutes + held,
      responseDueAt: newResponseDue,
      resolutionDueAt: newResolutionDue,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RESUME",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
}

/** Field tech marks "work done" — awaiting client sign-off. */
export async function resolveServiceIssue(id: string) {
  const session = await requireRole([
    Role.ADMIN,
    Role.MANAGER,
    Role.SUPERVISOR,
    Role.EMPLOYEE,
  ]);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true, firstResponseAt: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (
    issue.status === ServiceStatus.CLOSED ||
    issue.status === ServiceStatus.CANCELLED ||
    issue.status === ServiceStatus.RESOLVED ||
    issue.status === ServiceStatus.VERIFIED
  ) {
    throw new Error(`Cannot resolve a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.RESOLVED,
      resolvedAt: new Date(),
      firstResponseAt: issue.firstResponseAt ?? new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "RESOLVE",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
  revalidatePath(`/mobile/service`);
}

/** Manager / supervisor confirms the fix holds. */
export async function verifyServiceIssue(
  id: string,
  payload: { clientSignoffName: string },
) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  if (!payload.clientSignoffName || payload.clientSignoffName.trim().length < 1) {
    throw new Error("Client sign-off name required");
  }

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (issue.status !== ServiceStatus.RESOLVED) {
    throw new Error(`Cannot verify a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.VERIFIED,
      clientSignoffName: payload.clientSignoffName,
      clientSignoffAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "VERIFY",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath(`/service/issues/${id}`);
}

/**
 * Close the ticket. If coverage is BILLABLE, billableAmount is captured here
 * but the invoice itself is produced by the separate billServiceIssue action.
 */
export async function closeServiceIssue(id: string, raw: unknown) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  const input = ServiceIssueCloseInput.parse(raw);

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true, coverage: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (issue.status !== ServiceStatus.VERIFIED && issue.status !== ServiceStatus.RESOLVED) {
    throw new Error(`Cannot close a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.CLOSED,
      closedAt: new Date(),
      closedByUserId: session.user.id,
      clientSignoffName: input.clientSignoffName,
      clientSignoffAt: new Date(),
      closureNotes: input.closureNotes ?? null,
      billableAmount: input.billableAmount ? new D(input.billableAmount) : null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CLOSE",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath("/service");
  revalidatePath(`/service/issues/${id}`);
}

/** Close-out with no work done (e.g. duplicate report). */
export async function cancelServiceIssue(id: string, reason: string) {
  const session = await requireRole([Role.ADMIN, Role.MANAGER, Role.SUPERVISOR]);
  if (!reason || reason.trim().length < 3) {
    throw new Error("Reason required to cancel ticket");
  }

  const issue = await db.serviceIssue.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!issue) throw new Error("Ticket not found");
  if (TERMINAL_STATUSES.includes(issue.status)) {
    throw new Error(`Cannot cancel a ${issue.status} ticket`);
  }

  await db.serviceIssue.update({
    where: { id },
    data: {
      status: ServiceStatus.CANCELLED,
      closureNotes: reason,
      closedAt: new Date(),
      closedByUserId: session.user.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CANCEL",
      entity: "ServiceIssue",
      entityId: id,
    },
  });

  revalidatePath("/service");
  revalidatePath(`/service/issues/${id}`);
}
