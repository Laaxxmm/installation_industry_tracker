import { Role } from "@prisma/client";
import { auth } from "./auth";
import { db } from "./db";

export class AuthorizationError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationError();
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new AuthorizationError(`Requires one of: ${roles.join(", ")}`);
  }
  return session;
}

/** Supervisor must be assigned to the project; managers/admins always pass. */
export async function canBookConsumptionFor(projectId: string) {
  const session = await requireSession();
  const role = session.user.role;
  if (role === Role.ADMIN || role === Role.MANAGER) return session;
  if (role === Role.SUPERVISOR) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { siteSupervisorId: true },
    });
    if (project?.siteSupervisorId === session.user.id) return session;
  }
  throw new AuthorizationError("Cannot book consumption for this project");
}

export async function canApproveTimesheetEntry(entryId: string) {
  const session = await requireSession();
  const role = session.user.role;
  if (role === Role.ADMIN || role === Role.MANAGER) return session;
  if (role === Role.SUPERVISOR) {
    const entry = await db.timeEntry.findUnique({
      where: { id: entryId },
      select: { project: { select: { siteSupervisorId: true } } },
    });
    if (entry?.project.siteSupervisorId === session.user.id) return session;
  }
  throw new AuthorizationError("Cannot approve this timesheet");
}

export function hasRole(session: { user: { role: Role } }, roles: Role[]) {
  return roles.includes(session.user.role);
}

/** A quote is editable only while DRAFT / REVISED / CHANGES_REQUESTED by its author or MANAGER+. */
export function canEditQuote(
  session: { user: { id: string; role: Role } },
  quote: { createdById: string; status: string },
): boolean {
  const role = session.user.role;
  const editableStatus =
    quote.status === "DRAFT" ||
    quote.status === "REVISED" ||
    quote.status === "CHANGES_REQUESTED";
  if (!editableStatus) return false;
  if (role === Role.ADMIN || role === Role.MANAGER) return true;
  return quote.createdById === session.user.id;
}

/** Only MANAGER+ can issue/cancel/markPaid on client invoices. */
export function canIssueInvoice(session: { user: { role: Role } }): boolean {
  return hasRole(session, [Role.ADMIN, Role.MANAGER]);
}

/** Progress edits: MANAGER+ anywhere, SUPERVISOR only on own project. */
export async function canUpdateProgressFor(projectId: string) {
  const session = await requireSession();
  const role = session.user.role;
  if (role === Role.ADMIN || role === Role.MANAGER) return session;
  if (role === Role.SUPERVISOR) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { siteSupervisorId: true },
    });
    if (project?.siteSupervisorId === session.user.id) return session;
  }
  throw new AuthorizationError("Cannot update progress for this project");
}
