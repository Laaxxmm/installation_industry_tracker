import { describe, expect, it } from "vitest";
import {
  applyHoldOffset,
  computeDueDates,
  isBreached,
  minutesBetween,
  resolveSLA,
} from "@/lib/sla";

describe("resolveSLA", () => {
  it("uses the AMC-specific SLA row when one matches the priority", () => {
    const out = resolveSLA("P1", [
      { priority: "P1", responseHours: 2, resolutionHours: 6 },
      { priority: "P2", responseHours: 8, resolutionHours: 48 },
    ]);
    expect(out).toEqual({ responseHours: 2, resolutionHours: 6 });
  });

  it("falls back to the default table when no AMC row matches", () => {
    const out = resolveSLA("P2", [
      { priority: "P1", responseHours: 2, resolutionHours: 6 },
    ]);
    // Default P2: 4h response, 24h resolution.
    expect(out.responseHours).toBe(4);
    expect(out.resolutionHours).toBe(24);
  });

  it("uses defaults when AMC rows are null", () => {
    const out = resolveSLA("P3", null);
    expect(out.responseHours).toBe(8);
    expect(out.resolutionHours).toBe(72);
  });
});

describe("computeDueDates", () => {
  const reported = new Date("2026-04-20T10:00:00.000Z");

  it("computes deadlines from defaults", () => {
    const out = computeDueDates({ reportedAt: reported, priority: "P1" });
    // P1 default: 1h / 4h.
    expect(out.responseHours).toBe(1);
    expect(out.resolutionHours).toBe(4);
    expect(out.responseDueAt.toISOString()).toBe("2026-04-20T11:00:00.000Z");
    expect(out.resolutionDueAt.toISOString()).toBe("2026-04-20T14:00:00.000Z");
  });

  it("prefers AMC-specific SLA over defaults", () => {
    const out = computeDueDates({
      reportedAt: reported,
      priority: "P1",
      amcSlas: [{ priority: "P1", responseHours: 2, resolutionHours: 8 }],
    });
    expect(out.responseDueAt.toISOString()).toBe("2026-04-20T12:00:00.000Z");
    expect(out.resolutionDueAt.toISOString()).toBe("2026-04-20T18:00:00.000Z");
  });
});

describe("hold-time math", () => {
  it("applyHoldOffset pushes the deadline forward by held minutes", () => {
    const due = new Date("2026-04-20T14:00:00.000Z");
    const pushed = applyHoldOffset(due, 90);
    expect(pushed.toISOString()).toBe("2026-04-20T15:30:00.000Z");
  });

  it("minutesBetween is signed — positive when b is after a", () => {
    const a = new Date("2026-04-20T10:00:00.000Z");
    const b = new Date("2026-04-20T10:45:00.000Z");
    expect(minutesBetween(a, b)).toBe(45);
    expect(minutesBetween(b, a)).toBe(-45);
  });

  it("isBreached respects hold offset", () => {
    const due = new Date("2026-04-20T10:00:00.000Z");
    const now = new Date("2026-04-20T10:30:00.000Z");
    // Without hold: already breached.
    expect(isBreached({ dueAt: due, holdMinutes: 0, now })).toBe(true);
    // With 60 min of hold: deadline shifts to 11:00, not breached at 10:30.
    expect(isBreached({ dueAt: due, holdMinutes: 60, now })).toBe(false);
  });

  it("isBreached returns false for null dueAt", () => {
    expect(isBreached({ dueAt: null, holdMinutes: 0, now: new Date() })).toBe(false);
  });
});
