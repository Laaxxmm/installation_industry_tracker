import { describe, it, expect } from "vitest";
import { projectPercentComplete, isOverdue } from "@/lib/progress";

describe("projectPercentComplete", () => {
  it("weighted avg with mixed weights and %", () => {
    const r = projectPercentComplete([
      { percentComplete: 100, weight: 1 },
      { percentComplete: 50, weight: 2 },
      { percentComplete: 0, weight: 1 },
    ]);
    // (100*1 + 50*2 + 0*1) / 4 = 200/4 = 50
    expect(r.toFixed(2)).toBe("50.00");
  });

  it("all-zero milestones return 0", () => {
    const r = projectPercentComplete([
      { percentComplete: 0, weight: 1 },
      { percentComplete: 0, weight: 2 },
    ]);
    expect(r.toFixed(2)).toBe("0.00");
  });

  it("no milestones returns 0", () => {
    expect(projectPercentComplete([]).toFixed(2)).toBe("0.00");
  });

  it("all-done at weight 1 returns 100", () => {
    expect(
      projectPercentComplete([
        { percentComplete: 100, weight: 1 },
        { percentComplete: 100, weight: 3 },
      ]).toFixed(2),
    ).toBe("100.00");
  });

  it("zero-weight fallback returns 0 without divide-by-zero", () => {
    expect(projectPercentComplete([{ percentComplete: 50, weight: 0 }]).toFixed(2)).toBe("0.00");
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("DONE milestone in past is not overdue", () => {
    expect(
      isOverdue(
        {
          percentComplete: 100,
          weight: 1,
          status: "DONE",
          plannedEnd: new Date("2026-01-01T00:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("IN_PROGRESS milestone past plannedEnd is overdue", () => {
    expect(
      isOverdue(
        {
          percentComplete: 50,
          weight: 1,
          status: "IN_PROGRESS",
          plannedEnd: new Date("2026-06-01T00:00:00Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  it("future plannedEnd is not overdue", () => {
    expect(
      isOverdue(
        {
          percentComplete: 50,
          weight: 1,
          status: "IN_PROGRESS",
          plannedEnd: new Date("2026-12-01T00:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("no plannedEnd is not overdue", () => {
    expect(
      isOverdue(
        { percentComplete: 0, weight: 1, status: "PENDING", plannedEnd: null },
        now,
      ),
    ).toBe(false);
  });
});
