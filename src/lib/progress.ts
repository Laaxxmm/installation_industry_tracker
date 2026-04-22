import { Decimal } from "decimal.js";
import { toDecimal, zero } from "./money";

export type MilestoneLike = {
  percentComplete: Decimal | number | string;
  weight: Decimal | number | string;
  status?: string;
  plannedEnd?: Date | null;
};

/**
 * Weighted average of percentComplete across milestones.
 * Returns a Decimal in [0, 100], rounded to 2dp.
 */
export function projectPercentComplete(milestones: MilestoneLike[]): Decimal {
  if (milestones.length === 0) return zero();
  let weightedSum = zero();
  let weightSum = zero();
  for (const m of milestones) {
    const w = toDecimal(m.weight);
    const p = toDecimal(m.percentComplete);
    weightedSum = weightedSum.plus(p.times(w));
    weightSum = weightSum.plus(w);
  }
  if (weightSum.isZero()) return zero();
  return weightedSum.div(weightSum).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Alias — same math, filtered on caller side. */
export const stagePercentComplete = projectPercentComplete;

export function isOverdue(m: MilestoneLike, now: Date = new Date()): boolean {
  if (m.status === "DONE") return false;
  if (!m.plannedEnd) return false;
  return m.plannedEnd.getTime() < now.getTime();
}
