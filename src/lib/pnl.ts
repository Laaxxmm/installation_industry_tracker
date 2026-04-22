import { Decimal } from "decimal.js";
import { BudgetCategory, EmploymentType, TimeEntryStatus } from "@prisma/client";
import { round2, sum, toDecimal, zero } from "./money";
import {
  istMonthBoundaries,
  istMonthsInRange,
  overlapMinutes,
} from "./time";
import { differenceInCalendarDays } from "date-fns";

// --- Types --------------------------------------------------------------

interface TimeEntryLike {
  id: string;
  employeeId: string;
  projectId: string;
  clockIn: Date;
  clockOut: Date | null;
  status: TimeEntryStatus;
}

interface RateCardLike {
  userId: string;
  type: EmploymentType;
  hourlyRate: Decimal | null;
  monthlySalary: Decimal | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

interface EmployeeLike {
  id: string;
  employmentType: EmploymentType | null;
  rateCards: RateCardLike[];
}

interface StockIssueLike {
  projectId: string;
  qty: Decimal;
  unitCostAtIssue: Decimal;
  issuedAt: Date;
}

interface DirectPurchaseLike {
  projectId: string;
  total: Decimal;
  category: BudgetCategory;
  purchasedAt: Date;
}

interface InvoiceLike {
  projectId: string;
  amount: Decimal;
  issuedAt: Date;
}

interface MaterialTransferLike {
  fromProjectId: string;
  toProjectId: string;
  qty: Decimal;
  unitCostAtTransfer: Decimal;
  transferredAt: Date;
}

interface OverheadLike {
  projectId: string;
  amount: Decimal;
  periodMonth: Date;
}

interface BudgetLineLike {
  projectId: string;
  category: BudgetCategory;
  total: Decimal;
}

export interface PnlInputs {
  projectId: string;
  range: { from: Date; to: Date };
  timeEntries: TimeEntryLike[];
  employees: EmployeeLike[];
  stockIssues: StockIssueLike[];
  directPurchases: DirectPurchaseLike[];
  invoices: InvoiceLike[];
  overheads: OverheadLike[];
  budgetLines: BudgetLineLike[];
  materialTransfers?: MaterialTransferLike[];
  // Project-level manually-supplied material value (e.g. imported from Excel).
  // When present it replaces the aggregated directMaterial in the P&L output.
  materialOverride?: Decimal | null;
}

export interface CategoryVariance {
  budget: Decimal;
  actual: Decimal;
  variance: Decimal;
  variancePct: Decimal | null;
}

export interface ProjectPnl {
  projectId: string;
  range: { from: Date; to: Date };
  revenue: Decimal;
  directLabor: Decimal;
  directLaborHourly: Decimal;
  directLaborSalaried: Decimal;
  directMaterial: Decimal;
  directMaterialFromStock: Decimal;
  directMaterialFromPurchase: Decimal;
  directMaterialTransfersIn: Decimal;
  directMaterialTransfersOut: Decimal;
  directOther: Decimal;
  contributionMargin: Decimal;
  overhead: Decimal;
  netPnl: Decimal;
  // When non-null, the project's materialsSupplied override was applied:
  // directMaterial equals this value and sub-lines reflect raw source data.
  materialOverride: Decimal | null;
  variance: {
    material: CategoryVariance;
    labor: CategoryVariance;
    other: CategoryVariance;
  };
}

// --- Rate resolution ----------------------------------------------------

function resolveRateCard(cards: RateCardLike[], at: Date): RateCardLike | null {
  // Pick the rate card whose [effectiveFrom, effectiveTo) window contains `at`.
  // If multiple match (shouldn't happen) pick the one with latest effectiveFrom.
  let best: RateCardLike | null = null;
  for (const c of cards) {
    if (c.effectiveFrom.getTime() > at.getTime()) continue;
    if (c.effectiveTo && c.effectiveTo.getTime() <= at.getTime()) continue;
    if (!best || c.effectiveFrom.getTime() > best.effectiveFrom.getTime()) best = c;
  }
  return best;
}

function rateBoundariesWithin(
  cards: RateCardLike[],
  from: Date,
  to: Date,
): Date[] {
  // Boundaries are card transition points that fall strictly inside (from, to).
  const bounds = new Set<number>();
  for (const c of cards) {
    if (c.effectiveFrom.getTime() > from.getTime() && c.effectiveFrom.getTime() < to.getTime()) {
      bounds.add(c.effectiveFrom.getTime());
    }
    if (c.effectiveTo && c.effectiveTo.getTime() > from.getTime() && c.effectiveTo.getTime() < to.getTime()) {
      bounds.add(c.effectiveTo.getTime());
    }
  }
  return Array.from(bounds).sort().map((t) => new Date(t));
}

// --- Labor cost ---------------------------------------------------------

/**
 * Hourly labor: for each approved entry, split at rate-card boundaries and
 * at the query-range boundaries; cost each slice at its applicable hourly rate.
 */
export function computeHourlyLaborByProject(
  entries: TimeEntryLike[],
  employeesById: Map<string, EmployeeLike>,
  range: { from: Date; to: Date },
): Map<string, Decimal> {
  const byProject = new Map<string, Decimal>();
  for (const entry of entries) {
    if (entry.status !== TimeEntryStatus.APPROVED) continue;
    if (!entry.clockOut) continue;
    const employee = employeesById.get(entry.employeeId);
    if (!employee || employee.employmentType !== EmploymentType.HOURLY) continue;

    const sliceStart = new Date(Math.max(entry.clockIn.getTime(), range.from.getTime()));
    const sliceEnd = new Date(Math.min(entry.clockOut.getTime(), range.to.getTime()));
    if (sliceEnd.getTime() <= sliceStart.getTime()) continue;

    const breakpoints = [
      sliceStart,
      ...rateBoundariesWithin(employee.rateCards, sliceStart, sliceEnd),
      sliceEnd,
    ];

    let cost = zero();
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const a = breakpoints[i];
      const b = breakpoints[i + 1];
      const mins = overlapMinutes(a, b, a, b);
      if (mins === 0) continue;
      const rateCard = resolveRateCard(employee.rateCards, a);
      const rate = rateCard?.hourlyRate ? toDecimal(rateCard.hourlyRate) : zero();
      cost = cost.plus(rate.times(mins).div(60));
    }

    const existing = byProject.get(entry.projectId) ?? zero();
    byProject.set(entry.projectId, existing.plus(cost));
  }
  return byProject;
}

/**
 * Salaried labor: for each employee × month intersecting the range,
 * allocate salary proportionally to minutes logged per project that month.
 * Month may be partially in range — prorate salary by calendar days inside range.
 * Returns cost attributable to each project. If totalMinutes==0, nothing is charged.
 */
export function computeSalariedLaborByProject(
  entries: TimeEntryLike[],
  employeesById: Map<string, EmployeeLike>,
  range: { from: Date; to: Date },
): Map<string, Decimal> {
  const byProject = new Map<string, Decimal>();

  // Group employees -> month -> (projectId -> minutes) for approved entries.
  const salariedEmployees = Array.from(employeesById.values()).filter(
    (e) => e.employmentType === EmploymentType.SALARIED,
  );

  for (const emp of salariedEmployees) {
    const empEntries = entries.filter(
      (e) =>
        e.employeeId === emp.id &&
        e.status === TimeEntryStatus.APPROVED &&
        e.clockOut,
    );
    if (empEntries.length === 0) continue;

    // For each month intersecting the range:
    const months = istMonthsInRange(range.from, range.to);
    for (const monthStart of months) {
      const { start: mStart, end: mEnd } = istMonthBoundaries(monthStart);

      // Sum minutes for this employee in month M by project (using whole-month minutes, not range-clipped).
      const minutesByProj = new Map<string, number>();
      let totalMinutes = 0;
      for (const e of empEntries) {
        const mins = overlapMinutes(e.clockIn, e.clockOut!, mStart, mEnd);
        if (mins === 0) continue;
        minutesByProj.set(e.projectId, (minutesByProj.get(e.projectId) ?? 0) + mins);
        totalMinutes += mins;
      }
      if (totalMinutes === 0) continue;

      // Resolve salary at middle-of-month (stable choice).
      const midMonth = new Date((mStart.getTime() + mEnd.getTime()) / 2);
      const card = resolveRateCard(emp.rateCards, midMonth);
      const salary = card?.monthlySalary ? toDecimal(card.monthlySalary) : zero();
      if (salary.lte(0)) continue;

      // Prorate salary by days in range overlap with month.
      const overlapStart = new Date(Math.max(mStart.getTime(), range.from.getTime()));
      const overlapEnd = new Date(Math.min(mEnd.getTime(), range.to.getTime()));
      const daysInMonth = differenceInCalendarDays(mEnd, mStart) + 1;
      const daysInOverlap = Math.max(
        0,
        differenceInCalendarDays(overlapEnd, overlapStart) + 1,
      );
      const effectiveSalary = salary.times(daysInOverlap).div(daysInMonth);

      for (const [projectId, mins] of minutesByProj) {
        const cost = effectiveSalary.times(mins).div(totalMinutes);
        const existing = byProject.get(projectId) ?? zero();
        byProject.set(projectId, existing.plus(cost));
      }
    }
  }
  return byProject;
}

// --- Full project P&L ---------------------------------------------------

export function computeProjectPnl(inputs: PnlInputs): ProjectPnl {
  const { projectId, range } = inputs;

  const employeesById = new Map(inputs.employees.map((e) => [e.id, e]));

  // Filter entries to this project for labor buckets (labor helpers handle range clipping).
  const projectEntries = inputs.timeEntries.filter((e) => e.projectId === projectId);

  // For salaried allocation we actually need ALL entries for salaried employees (across projects)
  // so denominator totalMinutes is correct. So run the salaried helper against the full set.
  const hourlyByProject = computeHourlyLaborByProject(projectEntries, employeesById, range);
  const salariedByProject = computeSalariedLaborByProject(inputs.timeEntries, employeesById, range);

  const directLaborHourly = hourlyByProject.get(projectId) ?? zero();
  const directLaborSalaried = salariedByProject.get(projectId) ?? zero();
  const directLabor = directLaborHourly.plus(directLaborSalaried);

  // Materials
  const inRange = (d: Date) =>
    d.getTime() >= range.from.getTime() && d.getTime() < range.to.getTime();

  const stockIssues = inputs.stockIssues.filter(
    (i) => i.projectId === projectId && inRange(i.issuedAt),
  );
  const directMaterialFromStock = stockIssues.reduce<Decimal>(
    (acc, i) => acc.plus(toDecimal(i.qty).times(toDecimal(i.unitCostAtIssue))),
    zero(),
  );

  const purchases = inputs.directPurchases.filter(
    (p) => p.projectId === projectId && inRange(p.purchasedAt),
  );
  const directMaterialFromPurchase = purchases
    .filter((p) => p.category === BudgetCategory.MATERIAL)
    .reduce<Decimal>((acc, p) => acc.plus(toDecimal(p.total)), zero());
  const directOther = purchases
    .filter((p) => p.category === BudgetCategory.OTHER)
    .reduce<Decimal>((acc, p) => acc.plus(toDecimal(p.total)), zero());

  // Inter-project transfers: sender credits its material cost; receiver debits.
  const transfers = inputs.materialTransfers ?? [];
  const transfersIn = transfers
    .filter((t) => t.toProjectId === projectId && inRange(t.transferredAt))
    .reduce<Decimal>(
      (acc, t) => acc.plus(toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer))),
      zero(),
    );
  const transfersOut = transfers
    .filter((t) => t.fromProjectId === projectId && inRange(t.transferredAt))
    .reduce<Decimal>(
      (acc, t) => acc.plus(toDecimal(t.qty).times(toDecimal(t.unitCostAtTransfer))),
      zero(),
    );

  const computedMaterial = directMaterialFromStock
    .plus(directMaterialFromPurchase)
    .plus(transfersIn)
    .minus(transfersOut);

  const override =
    inputs.materialOverride !== null && inputs.materialOverride !== undefined
      ? toDecimal(inputs.materialOverride)
      : null;
  // Additive: "Direct materials" sub = inventory-sourced, "Direct other" sub = backend override.
  const directMaterial = override ? computedMaterial.plus(override) : computedMaterial;

  // Revenue
  const revenue = inputs.invoices
    .filter((i) => i.projectId === projectId && inRange(i.issuedAt))
    .reduce<Decimal>((acc, i) => acc.plus(toDecimal(i.amount)), zero());

  const contributionMargin = revenue.minus(directLabor).minus(directMaterial).minus(directOther);

  // Overhead — include months whose first-day falls inside [from, to)
  const overhead = inputs.overheads
    .filter(
      (o) =>
        o.projectId === projectId &&
        o.periodMonth.getTime() >= range.from.getTime() &&
        o.periodMonth.getTime() < range.to.getTime(),
    )
    .reduce<Decimal>((acc, o) => acc.plus(toDecimal(o.amount)), zero());

  const netPnl = contributionMargin.minus(overhead);

  // Variance
  const budgetByCat = (cat: BudgetCategory): Decimal =>
    sum(
      inputs.budgetLines.filter((b) => b.projectId === projectId && b.category === cat).map((b) => b.total),
    );

  const buildVariance = (budget: Decimal, actual: Decimal): CategoryVariance => {
    const variance = budget.minus(actual);
    const variancePct = budget.gt(0) ? variance.div(budget).times(100) : null;
    return {
      budget: round2(budget),
      actual: round2(actual),
      variance: round2(variance),
      variancePct: variancePct ? variancePct.toDecimalPlaces(2) : null,
    };
  };

  return {
    projectId,
    range,
    revenue: round2(revenue),
    directLabor: round2(directLabor),
    directLaborHourly: round2(directLaborHourly),
    directLaborSalaried: round2(directLaborSalaried),
    directMaterial: round2(directMaterial),
    directMaterialFromStock: round2(directMaterialFromStock),
    directMaterialFromPurchase: round2(directMaterialFromPurchase),
    directMaterialTransfersIn: round2(transfersIn),
    directMaterialTransfersOut: round2(transfersOut),
    directOther: round2(directOther),
    contributionMargin: round2(contributionMargin),
    overhead: round2(overhead),
    netPnl: round2(netPnl),
    materialOverride: override ? round2(override) : null,
    variance: {
      material: buildVariance(budgetByCat(BudgetCategory.MATERIAL), directMaterial),
      labor: buildVariance(budgetByCat(BudgetCategory.LABOR), directLabor),
      other: buildVariance(budgetByCat(BudgetCategory.OTHER), directOther),
    },
  };
}
