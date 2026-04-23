import { describe, expect, it } from "vitest";
import {
  istMonthBoundaries,
  istMonthsInRange,
  istMonthStart,
  overlapMinutes,
  minutesBetween,
} from "@/lib/time";

describe("istMonthStart", () => {
  it("returns UTC instant equal to IST 2026-04-01 00:00 for any April date", () => {
    // 2026-04-15 06:30 IST
    const d = new Date("2026-04-15T01:00:00.000Z");
    const start = istMonthStart(d);
    // IST midnight on 2026-04-01 = 2026-03-31 18:30 UTC
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });

  it("handles edge: UTC timestamp near month boundary is grouped by IST month", () => {
    // 2026-04-01 00:01 UTC is still 2026-04-01 05:31 IST → April
    const d = new Date("2026-04-01T00:01:00.000Z");
    const start = istMonthStart(d);
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
  });

  it("handles edge: just before IST month rollover stays in prior month", () => {
    // 2026-03-31 18:29 UTC = 2026-03-31 23:59 IST → still March in IST
    const d = new Date("2026-03-31T18:29:00.000Z");
    const start = istMonthStart(d);
    // IST midnight on 2026-03-01 = 2026-02-28 18:30 UTC
    expect(start.toISOString()).toBe("2026-02-28T18:30:00.000Z");
  });
});

describe("istMonthBoundaries", () => {
  it("end is last millisecond of month in IST", () => {
    const { start, end } = istMonthBoundaries(new Date("2026-04-10T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-03-31T18:30:00.000Z");
    // 2026-04-30 23:59:59.999 IST = 2026-04-30 18:29:59.999 UTC
    expect(end.toISOString()).toBe("2026-04-30T18:29:59.999Z");
  });
});

describe("istMonthsInRange", () => {
  it("enumerates months inclusive on both ends", () => {
    const months = istMonthsInRange(
      new Date("2026-01-15T00:00:00Z"),
      new Date("2026-04-10T00:00:00Z"),
    );
    expect(months.map((m) => m.toISOString())).toEqual([
      "2025-12-31T18:30:00.000Z", // Jan IST
      "2026-01-31T18:30:00.000Z", // Feb IST
      "2026-02-28T18:30:00.000Z", // Mar IST
      "2026-03-31T18:30:00.000Z", // Apr IST
    ]);
  });

  it("returns single month when from and to are in same IST month", () => {
    const months = istMonthsInRange(
      new Date("2026-04-05T00:00:00Z"),
      new Date("2026-04-20T00:00:00Z"),
    );
    expect(months).toHaveLength(1);
  });
});

describe("overlapMinutes", () => {
  it("returns full overlap when a is contained in b", () => {
    const a1 = new Date("2026-04-10T09:00:00Z");
    const a2 = new Date("2026-04-10T10:00:00Z");
    const b1 = new Date("2026-04-10T00:00:00Z");
    const b2 = new Date("2026-04-11T00:00:00Z");
    expect(overlapMinutes(a1, a2, b1, b2)).toBe(60);
  });

  it("returns 0 when disjoint", () => {
    const a1 = new Date("2026-04-10T09:00:00Z");
    const a2 = new Date("2026-04-10T10:00:00Z");
    const b1 = new Date("2026-04-10T10:00:00Z");
    const b2 = new Date("2026-04-10T11:00:00Z");
    expect(overlapMinutes(a1, a2, b1, b2)).toBe(0);
  });

  it("partial overlap", () => {
    const a1 = new Date("2026-04-10T09:00:00Z");
    const a2 = new Date("2026-04-10T12:00:00Z");
    const b1 = new Date("2026-04-10T11:00:00Z");
    const b2 = new Date("2026-04-10T13:00:00Z");
    expect(overlapMinutes(a1, a2, b1, b2)).toBe(60);
  });
});

describe("minutesBetween", () => {
  it("floors to whole minutes", () => {
    const a = new Date("2026-04-10T09:00:00Z");
    const b = new Date("2026-04-10T09:30:45Z");
    expect(minutesBetween(a, b)).toBe(30);
  });

  it("clamps negatives to 0", () => {
    const a = new Date("2026-04-10T09:00:00Z");
    const b = new Date("2026-04-10T08:00:00Z");
    expect(minutesBetween(a, b)).toBe(0);
  });
});
