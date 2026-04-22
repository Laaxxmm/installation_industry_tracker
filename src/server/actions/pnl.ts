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
