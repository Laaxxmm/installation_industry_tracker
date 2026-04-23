// Pure SLA helpers. No DB, no server code — safe to import from server actions,
// unit tests and (if needed) client components.

import type { ServicePriority } from "@prisma/client";

// Default SLA hours when no AMCSLA row matches.
// P1 = 4h, P2 = 24h, P3 = 72h, P4 = 7d. Mirrors the handoff prototype.
const DEFAULT_SLA: Record<ServicePriority, { responseHours: number; resolutionHours: number }> = {
  P1: { responseHours: 1, resolutionHours: 4 },
  P2: { responseHours: 4, resolutionHours: 24 },
  P3: { responseHours: 8, resolutionHours: 72 },
  P4: { responseHours: 24, resolutionHours: 24 * 7 },
};

export type SLAInput = {
  priority: ServicePriority;
  responseHours: number;
  resolutionHours: number;
};

/**
 * Resolve the SLA for a given priority, preferring an AMC-specific row if
 * present and falling back to DEFAULT_SLA. Returns hours (never null).
 */
export function resolveSLA(
  priority: ServicePriority,
  amcSlaRows: SLAInput[] | null | undefined,
): { responseHours: number; resolutionHours: number } {
  if (amcSlaRows) {
    const match = amcSlaRows.find((r) => r.priority === priority);
    if (match) return { responseHours: match.responseHours, resolutionHours: match.resolutionHours };
  }
  return DEFAULT_SLA[priority];
}

/**
 * Compute response and resolution deadlines from a reportedAt timestamp, a
 * priority, and an optional set of AMC SLA overrides.
 *
 * NOTE: times are plain wall-clock offsets. Business-hours-only clocks are a
 * v2 concern; the sweep script still works correctly against these values.
 */
export function computeDueDates(params: {
  reportedAt: Date;
  priority: ServicePriority;
  amcSlas?: SLAInput[] | null;
}): { responseDueAt: Date; resolutionDueAt: Date; responseHours: number; resolutionHours: number } {
  const sla = resolveSLA(params.priority, params.amcSlas ?? null);
  const reported = params.reportedAt.getTime();
  return {
    responseHours: sla.responseHours,
    resolutionHours: sla.resolutionHours,
    responseDueAt: new Date(reported + sla.responseHours * 60 * 60 * 1000),
    resolutionDueAt: new Date(reported + sla.resolutionHours * 60 * 60 * 1000),
  };
}

/**
 * Subtract accumulated on-hold minutes from a deadline to get the effective
 * breach timestamp. Used by the sweep script and the detail-page SLA clock.
 */
export function applyHoldOffset(dueAt: Date, holdMinutes: number): Date {
  return new Date(dueAt.getTime() + holdMinutes * 60 * 1000);
}

/**
 * Minutes between two instants (b - a). Negative if b is before a. Used when
 * resuming a ticket to bump its cumulative on-hold counter.
 */
export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (60 * 1000));
}

/**
 * True if the deadline has elapsed relative to `now`, taking hold offset
 * into account.
 */
export function isBreached(params: {
  dueAt: Date | null;
  holdMinutes: number;
  now: Date;
}): boolean {
  if (!params.dueAt) return false;
  const effective = applyHoldOffset(params.dueAt, params.holdMinutes);
  return effective.getTime() < params.now.getTime();
}
