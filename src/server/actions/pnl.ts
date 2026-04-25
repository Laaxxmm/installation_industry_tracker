import { db } from "@/server/db";
import {
  computeProjectPnl,
  type ProjectPnl,
  type PnlInputs,
} from "@/lib/pnl";
import { toDecimal } from "@/lib/money";

type Range = { from: Date; to: Date };

async function loadPnlInputs(projectId: string, range: Range): Promise<PnlInputs> {
  // Salaried allocation needs all entries for salaried employees across all projects
  // in the range to correctly compute denominator totalMinutes per month.
  // We load for (project-scoped entries) ∪ (all salaried-employee entries in range).
  // Everything that does not depend on another result runs in a single
  // Promise.all so the transaction hits Postgres once rather than in waves.

  const [
    project,
    budgetLines,
    projectTimeEntries,
    salariedEmployees,
    hourlyEmployees,
    stockIssues,
    directPurchases,
    invoices,
    clientInvoices,
    overheads,
    materialTransfers,
  ] = await Promise.all([
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, materialsSupplied: true },
    }),
    db.budgetLine.findMany({
      where: { projectId },
      select: { projectId: true, category: true, total: true },
    }),
    db.timeEntry.findMany({
      where: {
        projectId,
        clockIn: { lt: range.to },
        OR: [{ clockOut: null }, { clockOut: { gt: range.from } }],
      },
      select: {
        id: true,
        employeeId: true,
        projectId: true,
        clockIn: true,
        clockOut: true,
        status: true,
      },
    }),
    db.user.findMany({
      where: { employmentType: "SALARIED" },
      select: {
        id: true,
        employmentType: true,
        rateCards: true,
        timeEntries: {
          where: {
            clockIn: { lt: range.to },
            OR: [{ clockOut: null }, { clockOut: { gt: range.from } }],
          },
          select: {
            id: true,
            employeeId: true,
            projectId: true,
            clockIn: true,
            clockOut: true,
            status: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        employmentType: "HOURLY",
        timeEntries: { some: { projectId } },
      },
      select: { id: true, employmentType: true, rateCards: true },
    }),
    db.stockIssue.findMany({
      where: { projectId, issuedAt: { gte: range.from, lt: range.to } },
      select: {
        projectId: true,
        qty: true,
        unitCostAtIssue: true,
        issuedAt: true,
      },
    }),
    db.directPurchase.findMany({
      where: { projectId, purchasedAt: { gte: range.from, lt: range.to } },
      select: {
        projectId: true,
        total: true,
        category: true,
        purchasedAt: true,
      },
    }),
    db.invoice.findMany({
      where: { projectId, issuedAt: { gte: range.from, lt: range.to } },
      select: { projectId: true, amount: true, issuedAt: true },
    }),
    // GST-compliant client invoices (ISSUED or PAID count as revenue)
    db.clientInvoice.findMany({
      where: {
        projectId,
        status: { in: ["ISSUED", "PAID"] },
        issuedAt: { gte: range.from, lt: range.to },
      },
      select: { projectId: true, grandTotal: true, issuedAt: true },
    }),
    db.overheadAllocation.findMany({
      where: { projectId, periodMonth: { gte: range.from, lt: range.to } },
      select: { projectId: true, amount: true, periodMonth: true },
    }),
    db.materialTransfer.findMany({
      where: {
        transferredAt: { gte: range.from, lt: range.to },
        OR: [{ fromProjectId: projectId }, { toProjectId: projectId }],
      },
      select: {
        fromProjectId: true,
        toProjectId: true,
        qty: true,
        unitCostAtTransfer: true,
        transferredAt: true,
      },
    }),
  ]);

  const employees = [
    ...salariedEmployees.map((e) => ({
      id: e.id,
      employmentType: e.employmentType,
      rateCards: e.rateCards.map((c) => ({
        userId: c.userId,
        type: c.type,
        hourlyRate: c.hourlyRate ? toDecimal(c.hourlyRate) : null,
        monthlySalary: c.monthlySalary ? toDecimal(c.monthlySalary) : null,
        effectiveFrom: c.effectiveFrom,
        effectiveTo: c.effectiveTo,
      })),
    })),
    ...hourlyEmployees.map((e) => ({
      id: e.id,
      employmentType: e.employmentType,
      rateCards: e.rateCards.map((c) => ({
        userId: c.userId,
        type: c.type,
        hourlyRate: c.hourlyRate ? toDecimal(c.hourlyRate) : null,
        monthlySalary: c.monthlySalary ? toDecimal(c.monthlySalary) : null,
        effectiveFrom: c.effectiveFrom,
        effectiveTo: c.effectiveTo,
      })),
    })),
  ];

  // Dedup by id: project-scoped entries already include any salaried entries
  // for this project. Using a Set avoids the previous O(n×m) nested .some().
  const projectEntryIds = new Set(projectTimeEntries.map((t) => t.id));
  const salariedEntryList = salariedEmployees.flatMap((e) => e.timeEntries);
  const timeEntries = [
    ...projectTimeEntries,
    ...salariedEntryList.filter((t) => !projectEntryIds.has(t.id)),
  ];

  return {
    projectId: project.id,
    range,
    timeEntries,
    employees,
    stockIssues: stockIssues.map((i) => ({
      projectId: i.projectId,
      qty: toDecimal(i.qty),
      unitCostAtIssue: toDecimal(i.unitCostAtIssue),
      issuedAt: i.issuedAt,
    })),
    directPurchases: directPurchases.map((p) => ({
      projectId: p.projectId,
      total: toDecimal(p.total),
      category: p.category,
      purchasedAt: p.purchasedAt,
    })),
    invoices: [
      ...invoices.map((i) => ({
        projectId: i.projectId,
        amount: toDecimal(i.amount),
        issuedAt: i.issuedAt,
      })),
      ...clientInvoices
        .filter((i) => i.issuedAt !== null)
        .map((i) => ({
          projectId: i.projectId,
          // Revenue = grand total (tax-inclusive). P&L engine treats invoice
          // amount as revenue recognised, consistent with legacy Invoice rows.
          amount: toDecimal(i.grandTotal),
          issuedAt: i.issuedAt as Date,
        })),
    ],
    overheads: overheads.map((o) => ({
      projectId: o.projectId,
      amount: toDecimal(o.amount),
      periodMonth: o.periodMonth,
    })),
    budgetLines: budgetLines.map((b) => ({
      projectId: b.projectId,
      category: b.category,
      total: toDecimal(b.total),
    })),
    materialTransfers: materialTransfers.map((t) => ({
      fromProjectId: t.fromProjectId,
      toProjectId: t.toProjectId,
      qty: toDecimal(t.qty),
      unitCostAtTransfer: toDecimal(t.unitCostAtTransfer),
      transferredAt: t.transferredAt,
    })),
    materialOverride:
      project.materialsSupplied !== null && project.materialsSupplied !== undefined
        ? toDecimal(project.materialsSupplied)
        : null,
  };
}

export async function getProjectPnl(projectId: string, range: Range): Promise<ProjectPnl> {
  const inputs = await loadPnlInputs(projectId, range);
  return computeProjectPnl(inputs);
}

export function defaultRangeForProject(
  start: Date | null,
  end: Date | null,
): Range {
  const from = start ?? new Date("2020-01-01T00:00:00Z");
  const to = end ?? new Date(Date.now() + 365 * 24 * 3600 * 1000);
  return { from, to };
}

// Batched version: when computing P&L for many projects over the SAME date
// range, this fires 11 Prisma queries TOTAL (with `projectId IN (...)`)
// rather than 11 × N. Used by the dashboard portfolio cards and the
// reports page when an explicit date filter is set.
async function loadPnlInputsBatch(
  projectIds: string[],
  range: Range,
): Promise<Map<string, PnlInputs>> {
  if (projectIds.length === 0) return new Map();

  const [
    projects,
    budgetLines,
    projectTimeEntries,
    salariedEmployees,
    hourlyEmployees,
    stockIssues,
    directPurchases,
    invoices,
    clientInvoices,
    overheads,
    materialTransfers,
  ] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, materialsSupplied: true },
    }),
    db.budgetLine.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, category: true, total: true },
    }),
    db.timeEntry.findMany({
      where: {
        projectId: { in: projectIds },
        clockIn: { lt: range.to },
        OR: [{ clockOut: null }, { clockOut: { gt: range.from } }],
      },
      select: {
        id: true,
        employeeId: true,
        projectId: true,
        clockIn: true,
        clockOut: true,
        status: true,
      },
    }),
    db.user.findMany({
      where: { employmentType: "SALARIED" },
      select: {
        id: true,
        employmentType: true,
        rateCards: true,
        timeEntries: {
          where: {
            clockIn: { lt: range.to },
            OR: [{ clockOut: null }, { clockOut: { gt: range.from } }],
          },
          select: {
            id: true,
            employeeId: true,
            projectId: true,
            clockIn: true,
            clockOut: true,
            status: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        employmentType: "HOURLY",
        timeEntries: { some: { projectId: { in: projectIds } } },
      },
      select: { id: true, employmentType: true, rateCards: true },
    }),
    db.stockIssue.findMany({
      where: {
        projectId: { in: projectIds },
        issuedAt: { gte: range.from, lt: range.to },
      },
      select: {
        projectId: true,
        qty: true,
        unitCostAtIssue: true,
        issuedAt: true,
      },
    }),
    db.directPurchase.findMany({
      where: {
        projectId: { in: projectIds },
        purchasedAt: { gte: range.from, lt: range.to },
      },
      select: {
        projectId: true,
        total: true,
        category: true,
        purchasedAt: true,
      },
    }),
    db.invoice.findMany({
      where: {
        projectId: { in: projectIds },
        issuedAt: { gte: range.from, lt: range.to },
      },
      select: { projectId: true, amount: true, issuedAt: true },
    }),
    db.clientInvoice.findMany({
      where: {
        projectId: { in: projectIds },
        status: { in: ["ISSUED", "PAID"] },
        issuedAt: { gte: range.from, lt: range.to },
      },
      select: { projectId: true, grandTotal: true, issuedAt: true },
    }),
    db.overheadAllocation.findMany({
      where: {
        projectId: { in: projectIds },
        periodMonth: { gte: range.from, lt: range.to },
      },
      select: { projectId: true, amount: true, periodMonth: true },
    }),
    db.materialTransfer.findMany({
      where: {
        transferredAt: { gte: range.from, lt: range.to },
        OR: [
          { fromProjectId: { in: projectIds } },
          { toProjectId: { in: projectIds } },
        ],
      },
      select: {
        fromProjectId: true,
        toProjectId: true,
        qty: true,
        unitCostAtTransfer: true,
        transferredAt: true,
      },
    }),
  ]);

  // Convert salaried employees once (shared across all projects).
  const employeesAllSalaried = salariedEmployees.map((e) => ({
    id: e.id,
    employmentType: e.employmentType,
    rateCards: e.rateCards.map((c) => ({
      userId: c.userId,
      type: c.type,
      hourlyRate: c.hourlyRate ? toDecimal(c.hourlyRate) : null,
      monthlySalary: c.monthlySalary ? toDecimal(c.monthlySalary) : null,
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
    })),
  }));
  const employeesAllHourly = hourlyEmployees.map((e) => ({
    id: e.id,
    employmentType: e.employmentType,
    rateCards: e.rateCards.map((c) => ({
      userId: c.userId,
      type: c.type,
      hourlyRate: c.hourlyRate ? toDecimal(c.hourlyRate) : null,
      monthlySalary: c.monthlySalary ? toDecimal(c.monthlySalary) : null,
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
    })),
  }));
  const allSalariedEntries = salariedEmployees.flatMap((e) => e.timeEntries);

  const result = new Map<string, PnlInputs>();
  for (const project of projects) {
    const pid = project.id;
    const ownEntries = projectTimeEntries.filter((t) => t.projectId === pid);
    const ownEntryIds = new Set(ownEntries.map((t) => t.id));
    const timeEntries = [
      ...ownEntries,
      ...allSalariedEntries.filter((t) => !ownEntryIds.has(t.id)),
    ];

    result.set(pid, {
      projectId: pid,
      range,
      timeEntries,
      employees: [...employeesAllSalaried, ...employeesAllHourly],
      stockIssues: stockIssues
        .filter((i) => i.projectId === pid)
        .map((i) => ({
          projectId: i.projectId,
          qty: toDecimal(i.qty),
          unitCostAtIssue: toDecimal(i.unitCostAtIssue),
          issuedAt: i.issuedAt,
        })),
      directPurchases: directPurchases
        .filter((p) => p.projectId === pid)
        .map((p) => ({
          projectId: p.projectId,
          total: toDecimal(p.total),
          category: p.category,
          purchasedAt: p.purchasedAt,
        })),
      invoices: [
        ...invoices
          .filter((i) => i.projectId === pid)
          .map((i) => ({
            projectId: i.projectId,
            amount: toDecimal(i.amount),
            issuedAt: i.issuedAt,
          })),
        ...clientInvoices
          .filter((i) => i.projectId === pid && i.issuedAt !== null)
          .map((i) => ({
            projectId: i.projectId,
            amount: toDecimal(i.grandTotal),
            issuedAt: i.issuedAt as Date,
          })),
      ],
      overheads: overheads
        .filter((o) => o.projectId === pid)
        .map((o) => ({
          projectId: o.projectId,
          amount: toDecimal(o.amount),
          periodMonth: o.periodMonth,
        })),
      budgetLines: budgetLines
        .filter((b) => b.projectId === pid)
        .map((b) => ({
          projectId: b.projectId,
          category: b.category,
          total: toDecimal(b.total),
        })),
      materialTransfers: materialTransfers
        .filter((t) => t.fromProjectId === pid || t.toProjectId === pid)
        .map((t) => ({
          fromProjectId: t.fromProjectId,
          toProjectId: t.toProjectId,
          qty: toDecimal(t.qty),
          unitCostAtTransfer: toDecimal(t.unitCostAtTransfer),
          transferredAt: t.transferredAt,
        })),
      materialOverride:
        project.materialsSupplied !== null && project.materialsSupplied !== undefined
          ? toDecimal(project.materialsSupplied)
          : null,
    });
  }

  return result;
}

// Compute P&L for many projects over the same range with one batched
// load instead of one load per project. Returns a Map keyed by projectId
// in the same order as the input array (use the array to iterate if order
// matters). Projects in `projectIds` that don't exist in the DB are
// silently dropped from the result.
export async function getProjectPnlBatch(
  projectIds: string[],
  range: Range,
): Promise<Map<string, ProjectPnl>> {
  const inputsByProject = await loadPnlInputsBatch(projectIds, range);
  const out = new Map<string, ProjectPnl>();
  for (const [pid, inputs] of inputsByProject) {
    out.set(pid, computeProjectPnl(inputs));
  }
  return out;
}
