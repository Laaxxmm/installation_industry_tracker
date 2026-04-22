import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";
import {
  BudgetCategory,
  EmploymentType,
  TimeEntryStatus,
} from "@prisma/client";
import { computeProjectPnl, type PnlInputs } from "@/lib/pnl";

// Helpers ---------------------------------------------------------------

const proj = "P1";
const proj2 = "P2";
const rangeApril = {
  from: new Date("2026-04-01T00:00:00Z"),
  to: new Date("2026-05-01T00:00:00Z"),
};

function makePnl(partial: Partial<PnlInputs>): PnlInputs {
  return {
    projectId: proj,
    range: rangeApril,
    timeEntries: [],
    employees: [],
    stockIssues: [],
    directPurchases: [],
    invoices: [],
    overheads: [],
    budgetLines: [],
    ...partial,
  };
}

// Hourly labor ----------------------------------------------------------

describe("computeProjectPnl — hourly labor", () => {
  it("charges 8h at ₹200 = ₹1,600", () => {
    const inputs = makePnl({
      employees: [
        {
          id: "E1",
          employmentType: EmploymentType.HOURLY,
          rateCards: [
            {
              userId: "E1",
              type: EmploymentType.HOURLY,
              hourlyRate: new Decimal(200),
              monthlySalary: null,
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [
        {
          id: "T1",
          employeeId: "E1",
          projectId: proj,
          clockIn: new Date("2026-04-10T03:30:00Z"), // 09:00 IST
          clockOut: new Date("2026-04-10T11:30:00Z"), // 17:00 IST
          status: TimeEntryStatus.APPROVED,
        },
      ],
    });

    const p = computeProjectPnl(inputs);
    expect(p.directLaborHourly.toFixed(2)).toBe("1600.00");
    expect(p.directLaborSalaried.toFixed(2)).toBe("0.00");
    expect(p.directLabor.toFixed(2)).toBe("1600.00");
  });

  it("splits at mid-entry rate-card boundary", () => {
    // Entry 08:00–12:00 UTC (4h). Rate card changes at 10:00 UTC from 100 -> 200.
    // Expected: 2h @ 100 + 2h @ 200 = 200 + 400 = 600
    const inputs = makePnl({
      employees: [
        {
          id: "E1",
          employmentType: EmploymentType.HOURLY,
          rateCards: [
            {
              userId: "E1",
              type: EmploymentType.HOURLY,
              hourlyRate: new Decimal(100),
              monthlySalary: null,
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: new Date("2026-04-10T10:00:00Z"),
            },
            {
              userId: "E1",
              type: EmploymentType.HOURLY,
              hourlyRate: new Decimal(200),
              monthlySalary: null,
              effectiveFrom: new Date("2026-04-10T10:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [
        {
          id: "T1",
          employeeId: "E1",
          projectId: proj,
          clockIn: new Date("2026-04-10T08:00:00Z"),
          clockOut: new Date("2026-04-10T12:00:00Z"),
          status: TimeEntryStatus.APPROVED,
        },
      ],
    });
    const p = computeProjectPnl(inputs);
    expect(p.directLaborHourly.toFixed(2)).toBe("600.00");
  });

  it("ignores non-APPROVED entries", () => {
    const inputs = makePnl({
      employees: [
        {
          id: "E1",
          employmentType: EmploymentType.HOURLY,
          rateCards: [
            {
              userId: "E1",
              type: EmploymentType.HOURLY,
              hourlyRate: new Decimal(200),
              monthlySalary: null,
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [
        {
          id: "T1",
          employeeId: "E1",
          projectId: proj,
          clockIn: new Date("2026-04-10T03:30:00Z"),
          clockOut: new Date("2026-04-10T11:30:00Z"),
          status: TimeEntryStatus.SUBMITTED,
        },
      ],
    });
    expect(computeProjectPnl(inputs).directLaborHourly.toFixed(2)).toBe("0.00");
  });
});

// Salaried labor --------------------------------------------------------

describe("computeProjectPnl — salaried labor", () => {
  it("allocates salary proportional to project minutes within a month", () => {
    // Salary ₹60,000/month. Employee works 5h on P1 and 3h on P2 in April.
    // Full-month in range → P1 share = 60000 * (5/8) = 37,500
    const inputs = makePnl({
      employees: [
        {
          id: "E1",
          employmentType: EmploymentType.SALARIED,
          rateCards: [
            {
              userId: "E1",
              type: EmploymentType.SALARIED,
              hourlyRate: null,
              monthlySalary: new Decimal(60000),
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [
        {
          id: "T1",
          employeeId: "E1",
          projectId: proj,
          clockIn: new Date("2026-04-10T04:30:00Z"), // 10:00 IST
          clockOut: new Date("2026-04-10T09:30:00Z"), // 15:00 IST (5h)
          status: TimeEntryStatus.APPROVED,
        },
        {
          id: "T2",
          employeeId: "E1",
          projectId: proj2,
          clockIn: new Date("2026-04-12T04:30:00Z"),
          clockOut: new Date("2026-04-12T07:30:00Z"), // 3h
          status: TimeEntryStatus.APPROVED,
        },
      ],
    });
    const p = computeProjectPnl(inputs);
    expect(p.directLaborSalaried.toFixed(2)).toBe("37500.00");
  });

  it("charges zero when employee logs no minutes that month (idle)", () => {
    const inputs = makePnl({
      employees: [
        {
          id: "E1",
          employmentType: EmploymentType.SALARIED,
          rateCards: [
            {
              userId: "E1",
              type: EmploymentType.SALARIED,
              hourlyRate: null,
              monthlySalary: new Decimal(60000),
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [],
    });
    expect(computeProjectPnl(inputs).directLaborSalaried.toFixed(2)).toBe("0.00");
  });
});

// Materials + revenue + overhead + variance -----------------------------

describe("computeProjectPnl — materials, revenue, overhead, variance", () => {
  it("materials from stock + direct purchase; other cost separated", () => {
    const inputs = makePnl({
      stockIssues: [
        {
          projectId: proj,
          qty: new Decimal(40),
          unitCostAtIssue: new Decimal(120),
          issuedAt: new Date("2026-04-10T00:00:00Z"),
        },
      ],
      directPurchases: [
        {
          projectId: proj,
          total: new Decimal(12000),
          category: BudgetCategory.MATERIAL,
          purchasedAt: new Date("2026-04-11T00:00:00Z"),
        },
        {
          projectId: proj,
          total: new Decimal(500),
          category: BudgetCategory.OTHER,
          purchasedAt: new Date("2026-04-12T00:00:00Z"),
        },
      ],
    });
    const p = computeProjectPnl(inputs);
    expect(p.directMaterialFromStock.toFixed(2)).toBe("4800.00");
    expect(p.directMaterialFromPurchase.toFixed(2)).toBe("12000.00");
    expect(p.directMaterial.toFixed(2)).toBe("16800.00");
    expect(p.directOther.toFixed(2)).toBe("500.00");
  });

  it("inter-project transfers credit sender, debit receiver at snapshot cost", () => {
    // Sender transfers out 5 units @ ₹120 = ₹600
    // Receiver (proj2) debits the same ₹600.
    const transfers = [
      {
        fromProjectId: proj,
        toProjectId: proj2,
        qty: new Decimal(5),
        unitCostAtTransfer: new Decimal(120),
        transferredAt: new Date("2026-04-15T00:00:00Z"),
      },
    ];

    // Sender: starts with a ₹1,000 stock issue, then transfers out ₹600
    const sender = computeProjectPnl(
      makePnl({
        stockIssues: [
          {
            projectId: proj,
            qty: new Decimal(10),
            unitCostAtIssue: new Decimal(100),
            issuedAt: new Date("2026-04-10T00:00:00Z"),
          },
        ],
        materialTransfers: transfers,
      }),
    );
    expect(sender.directMaterialFromStock.toFixed(2)).toBe("1000.00");
    expect(sender.directMaterialTransfersOut.toFixed(2)).toBe("600.00");
    expect(sender.directMaterialTransfersIn.toFixed(2)).toBe("0.00");
    expect(sender.directMaterial.toFixed(2)).toBe("400.00"); // 1000 − 600

    const receiver = computeProjectPnl(
      makePnl({
        projectId: proj2,
        materialTransfers: transfers,
      }),
    );
    expect(receiver.directMaterialTransfersIn.toFixed(2)).toBe("600.00");
    expect(receiver.directMaterialTransfersOut.toFixed(2)).toBe("0.00");
    expect(receiver.directMaterial.toFixed(2)).toBe("600.00");

    // Portfolio-level invariant: sender credit + receiver debit = 0
    const netImpact = receiver.directMaterial.minus(
      sender.directMaterialTransfersOut,
    );
    expect(netImpact.toFixed(2)).toBe("0.00");
  });

  it("transfers outside the range are ignored", () => {
    const p = computeProjectPnl(
      makePnl({
        materialTransfers: [
          {
            fromProjectId: proj,
            toProjectId: proj2,
            qty: new Decimal(5),
            unitCostAtTransfer: new Decimal(120),
            transferredAt: new Date("2026-03-15T00:00:00Z"), // before April range
          },
        ],
      }),
    );
    expect(p.directMaterialTransfersOut.toFixed(2)).toBe("0.00");
  });

  it("full golden-path scenario (matches plan verification §9)", () => {
    // Hourly: 8h × ₹200 = ₹1,600
    // Salaried: 5h on P1, 3h on P2, April fully in range → 60000 × 5/8 = ₹37,500
    // Material: 40 × 120 = ₹4,800 from stock + ₹12,000 direct = ₹16,800
    // Revenue: ₹2,00,000
    // Contribution = 2,00,000 − 1,600 − 37,500 − 16,800 = ₹1,44,100
    // Overhead ₹25,000 → Net = ₹1,19,100
    const inputs = makePnl({
      employees: [
        {
          id: "Ehour",
          employmentType: EmploymentType.HOURLY,
          rateCards: [
            {
              userId: "Ehour",
              type: EmploymentType.HOURLY,
              hourlyRate: new Decimal(200),
              monthlySalary: null,
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
        {
          id: "Esal",
          employmentType: EmploymentType.SALARIED,
          rateCards: [
            {
              userId: "Esal",
              type: EmploymentType.SALARIED,
              hourlyRate: null,
              monthlySalary: new Decimal(60000),
              effectiveFrom: new Date("2026-01-01T00:00:00Z"),
              effectiveTo: null,
            },
          ],
        },
      ],
      timeEntries: [
        {
          id: "Th",
          employeeId: "Ehour",
          projectId: proj,
          clockIn: new Date("2026-04-10T03:30:00Z"), // 09:00 IST
          clockOut: new Date("2026-04-10T11:30:00Z"), // 17:00 IST
          status: TimeEntryStatus.APPROVED,
        },
        {
          id: "Ts1",
          employeeId: "Esal",
          projectId: proj,
          clockIn: new Date("2026-04-10T04:30:00Z"),
          clockOut: new Date("2026-04-10T09:30:00Z"), // 5h
          status: TimeEntryStatus.APPROVED,
        },
        {
          id: "Ts2",
          employeeId: "Esal",
          projectId: proj2,
          clockIn: new Date("2026-04-12T04:30:00Z"),
          clockOut: new Date("2026-04-12T07:30:00Z"), // 3h
          status: TimeEntryStatus.APPROVED,
        },
      ],
      stockIssues: [
        {
          projectId: proj,
          qty: new Decimal(40),
          unitCostAtIssue: new Decimal(120),
          issuedAt: new Date("2026-04-10T00:00:00Z"),
        },
      ],
      directPurchases: [
        {
          projectId: proj,
          total: new Decimal(12000),
          category: BudgetCategory.MATERIAL,
          purchasedAt: new Date("2026-04-11T00:00:00Z"),
        },
      ],
      invoices: [
        {
          projectId: proj,
          amount: new Decimal(200000),
          issuedAt: new Date("2026-04-20T00:00:00Z"),
        },
      ],
      overheads: [
        {
          projectId: proj,
          amount: new Decimal(25000),
          periodMonth: new Date("2026-04-01T00:00:00Z"),
        },
      ],
      budgetLines: [
        { projectId: proj, category: BudgetCategory.MATERIAL, total: new Decimal(400000) },
        { projectId: proj, category: BudgetCategory.LABOR, total: new Decimal(200000) },
        { projectId: proj, category: BudgetCategory.OTHER, total: new Decimal(50000) },
      ],
    });

    const p = computeProjectPnl(inputs);
    expect(p.directLaborHourly.toFixed(2)).toBe("1600.00");
    expect(p.directLaborSalaried.toFixed(2)).toBe("37500.00");
    expect(p.directLabor.toFixed(2)).toBe("39100.00");
    expect(p.directMaterial.toFixed(2)).toBe("16800.00");
    expect(p.directOther.toFixed(2)).toBe("0.00");
    expect(p.revenue.toFixed(2)).toBe("200000.00");
    expect(p.contributionMargin.toFixed(2)).toBe("144100.00");
    expect(p.overhead.toFixed(2)).toBe("25000.00");
    expect(p.netPnl.toFixed(2)).toBe("119100.00");

    // Variance: budget 4,00,000 − actual 16,800 = 3,83,200 (under)
    expect(p.variance.material.variance.toFixed(2)).toBe("383200.00");
    expect(p.variance.labor.variance.toFixed(2)).toBe("160900.00");
    expect(p.variance.other.variance.toFixed(2)).toBe("50000.00");
  });
});
