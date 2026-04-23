import { describe, expect, it } from "vitest";
import { deriveCoverage, isCoverageOverride } from "@/lib/service-coverage";

describe("deriveCoverage — precedence rules", () => {
  const reportedAt = new Date("2026-05-15T10:00:00.000Z");

  it("returns AMC when active AMC window contains reportedAt", () => {
    const out = deriveCoverage({
      reportedAt,
      amc: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T23:59:59.000Z"),
      },
      project: null,
    });
    expect(out).toBe("AMC");
  });

  it("falls through AMC when AMC is not ACTIVE (e.g. ON_HOLD)", () => {
    const out = deriveCoverage({
      reportedAt,
      amc: {
        status: "ON_HOLD",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T23:59:59.000Z"),
      },
      project: null,
    });
    expect(out).toBe("BILLABLE");
  });

  it("falls through AMC when reportedAt is outside the contract window", () => {
    const out = deriveCoverage({
      reportedAt,
      amc: {
        status: "ACTIVE",
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T23:59:59.000Z"),
      },
      project: null,
    });
    expect(out).toBe("BILLABLE");
  });

  it("returns WARRANTY when no AMC applies and project is within default 180-day warranty", () => {
    const handover = new Date("2026-02-01T00:00:00.000Z"); // ~3.5 months before reportedAt
    const out = deriveCoverage({
      reportedAt,
      amc: null,
      project: { handoverAt: handover },
    });
    expect(out).toBe("WARRANTY");
  });

  it("returns BILLABLE when project is past warranty", () => {
    const handover = new Date("2025-01-01T00:00:00.000Z"); // >1 year before
    const out = deriveCoverage({
      reportedAt,
      amc: null,
      project: { handoverAt: handover },
    });
    expect(out).toBe("BILLABLE");
  });

  it("respects custom warrantyDays override", () => {
    const handover = new Date("2026-02-01T00:00:00.000Z");
    const shortWarranty = deriveCoverage({
      reportedAt,
      amc: null,
      project: { handoverAt: handover, warrantyDays: 30 }, // expired
    });
    expect(shortWarranty).toBe("BILLABLE");
    const longWarranty = deriveCoverage({
      reportedAt,
      amc: null,
      project: { handoverAt: handover, warrantyDays: 365 }, // still covered
    });
    expect(longWarranty).toBe("WARRANTY");
  });

  it("prefers AMC over warranty when both would match", () => {
    const out = deriveCoverage({
      reportedAt,
      amc: {
        status: "ACTIVE",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T23:59:59.000Z"),
      },
      project: { handoverAt: new Date("2026-02-01T00:00:00.000Z") },
    });
    expect(out).toBe("AMC");
  });

  it("returns BILLABLE with no AMC and no project handover", () => {
    const out = deriveCoverage({
      reportedAt,
      amc: null,
      project: { handoverAt: null },
    });
    expect(out).toBe("BILLABLE");
  });
});

describe("isCoverageOverride", () => {
  it("is true when chosen differs from derived", () => {
    expect(isCoverageOverride("BILLABLE", "GOODWILL")).toBe(true);
    expect(isCoverageOverride("AMC", "WARRANTY")).toBe(true);
  });

  it("is false when they match", () => {
    expect(isCoverageOverride("AMC", "AMC")).toBe(false);
    expect(isCoverageOverride("BILLABLE", "BILLABLE")).toBe(false);
  });
});
