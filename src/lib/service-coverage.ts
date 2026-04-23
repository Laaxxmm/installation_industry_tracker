// Pure coverage-derivation helper. Decides whether a service ticket is covered
// by an active AMC, a project warranty window, or falls through to BILLABLE.
//
// Inputs are plain data so this is trivially unit-testable and can be reused
// by the triage server action and by the dashboard to show a "would-be"
// coverage badge before triage is submitted.

import type { AMCStatus, ServiceCoverage } from "@prisma/client";

// Default post-handover warranty window. Real warranty terms will eventually
// live on the Project model; for now this is the house rule.
const DEFAULT_WARRANTY_DAYS = 180;

export type CoverageAMCInput = {
  status: AMCStatus;
  startDate: Date;
  endDate: Date;
};

export type CoverageProjectInput = {
  // handoverAt / commissionedAt — the date the warranty clock starts.
  // Null means "project never handed over" (no warranty).
  handoverAt: Date | null;
  warrantyDays?: number | null;
};

/**
 * Auto-derive a coverage decision from (AMC?, project?, reportedAt).
 *
 * Precedence:
 *   1. If there's an ACTIVE AMC whose window contains reportedAt → AMC.
 *   2. If the project has a handover date and reportedAt is within the
 *      warranty window → WARRANTY.
 *   3. Otherwise → BILLABLE.
 *
 * GOODWILL is never auto-derived — it's a human override captured on triage.
 */
export function deriveCoverage(params: {
  reportedAt: Date;
  amc: CoverageAMCInput | null;
  project: CoverageProjectInput | null;
}): ServiceCoverage {
  const reported = params.reportedAt.getTime();

  if (params.amc && params.amc.status === "ACTIVE") {
    const start = params.amc.startDate.getTime();
    const end = params.amc.endDate.getTime();
    if (reported >= start && reported <= end) return "AMC";
  }

  if (params.project && params.project.handoverAt) {
    const warrantyDays = params.project.warrantyDays ?? DEFAULT_WARRANTY_DAYS;
    const warrantyEnd = params.project.handoverAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000;
    if (reported >= params.project.handoverAt.getTime() && reported <= warrantyEnd) {
      return "WARRANTY";
    }
  }

  return "BILLABLE";
}

/**
 * True if an operator-chosen coverage differs from the auto-derived one.
 * Used by the triage server action to require `coverageOverrideReason`.
 */
export function isCoverageOverride(
  derived: ServiceCoverage,
  chosen: ServiceCoverage,
): boolean {
  return derived !== chosen;
}
