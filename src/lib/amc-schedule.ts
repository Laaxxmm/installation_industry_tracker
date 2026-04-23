// Pure AMC visit-schedule helper. Computes the SCHEDULED visit dates that
// `approveAMC` pre-generates. No DB — safe to unit-test.

import type { AMCFrequency } from "@prisma/client";

const MONTHS_BY_FREQUENCY: Record<AMCFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

/**
 * Given a contract window [startDate, endDate] and a frequency, return the
 * evenly-spaced visit dates. The first visit is at startDate + spacing so the
 * onboarding period isn't double-booked on day one; the last visit may land
 * at or before endDate.
 *
 * Examples:
 *   QUARTERLY, 1-year contract → 4 visits at months 3, 6, 9, 12.
 *   MONTHLY, 1-year contract → 12 visits.
 *   HALF_YEARLY, 2-year contract → 4 visits at months 6, 12, 18, 24.
 */
export function computeVisitSchedule(params: {
  startDate: Date;
  endDate: Date;
  frequency: AMCFrequency;
}): Date[] {
  const { startDate, endDate, frequency } = params;
  if (endDate.getTime() <= startDate.getTime()) return [];

  const spacingMonths = MONTHS_BY_FREQUENCY[frequency];
  const dates: Date[] = [];

  // Walk forward in whole months so DST shifts and month-length differences
  // don't compound (e.g. Feb → Mar is always "+1 month").
  let cursor = addMonths(startDate, spacingMonths);
  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(cursor);
    cursor = addMonths(cursor, spacingMonths);
  }

  return dates;
}

/**
 * Add whole months to a date, clamping to the last day of the target month if
 * the source day doesn't exist there (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addMonths(d: Date, months: number): Date {
  const result = new Date(d.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const daysInTarget = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, daysInTarget));
  return result;
}

/**
 * Number of visits per year implied by a frequency. Used for validator
 * consistency checks (QUARTERLY → visitsPerYear === 4).
 */
export function visitsPerYearFor(frequency: AMCFrequency): number {
  return 12 / MONTHS_BY_FREQUENCY[frequency];
}
