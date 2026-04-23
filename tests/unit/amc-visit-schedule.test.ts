import { describe, expect, it } from "vitest";
import { addMonths, computeVisitSchedule, visitsPerYearFor } from "@/lib/amc-schedule";

describe("computeVisitSchedule", () => {
  const start = new Date("2026-04-01T00:00:00.000Z");

  it("QUARTERLY × 1-year produces 4 visits at months 3/6/9/12", () => {
    const end = new Date("2027-04-01T00:00:00.000Z");
    const visits = computeVisitSchedule({ startDate: start, endDate: end, frequency: "QUARTERLY" });
    expect(visits).toHaveLength(4);
    expect(visits[0].toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(visits[1].toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(visits[2].toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(visits[3].toISOString()).toBe("2027-04-01T00:00:00.000Z");
  });

  it("MONTHLY × 1-year produces 12 visits", () => {
    const end = new Date("2027-04-01T00:00:00.000Z");
    const visits = computeVisitSchedule({ startDate: start, endDate: end, frequency: "MONTHLY" });
    expect(visits).toHaveLength(12);
  });

  it("HALF_YEARLY × 2-year produces 4 visits at months 6/12/18/24", () => {
    const end = new Date("2028-04-01T00:00:00.000Z");
    const visits = computeVisitSchedule({
      startDate: start,
      endDate: end,
      frequency: "HALF_YEARLY",
    });
    expect(visits).toHaveLength(4);
    expect(visits[0].toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(visits[3].toISOString()).toBe("2028-04-01T00:00:00.000Z");
  });

  it("returns empty array for zero/negative windows", () => {
    const same = new Date("2026-04-01T00:00:00.000Z");
    expect(computeVisitSchedule({ startDate: start, endDate: same, frequency: "QUARTERLY" })).toEqual([]);
  });
});

describe("addMonths", () => {
  it("handles short-month clamping (Jan 31 + 1 month → Feb 28)", () => {
    const jan31 = new Date("2027-01-31T00:00:00.000Z");
    const plus1 = addMonths(jan31, 1);
    expect(plus1.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("handles leap-year February correctly (2028 is a leap year)", () => {
    const jan31 = new Date("2028-01-31T00:00:00.000Z");
    const plus1 = addMonths(jan31, 1);
    expect(plus1.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("crosses year boundaries cleanly", () => {
    const dec15 = new Date("2026-12-15T00:00:00.000Z");
    const plus3 = addMonths(dec15, 3);
    expect(plus3.toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });
});

describe("visitsPerYearFor", () => {
  it("returns the correct count per frequency", () => {
    expect(visitsPerYearFor("MONTHLY")).toBe(12);
    expect(visitsPerYearFor("QUARTERLY")).toBe(4);
    expect(visitsPerYearFor("HALF_YEARLY")).toBe(2);
    expect(visitsPerYearFor("YEARLY")).toBe(1);
  });
});
